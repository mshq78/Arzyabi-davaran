/**
 * Persistence layer for the GERA API.
 *
 * Every collection lives in its own Postgres table (`gera_<name>`) as `key TEXT PRIMARY KEY, data JSONB`.
 * Hot lookup fields get expression indexes; `offline_uuid` is UNIQUE so offline retries are idempotent even
 * when two sync requests race. `MemoryStore` implements the same contract for unit tests.
 */

export const STORE_NAMES = [
  'users',
  'events',
  'event_members',
  'activities',
  'groups',
  'participants',
  'assignments',
  'behaviors',
  'observations',
  'coverage_marks',
  'audit_logs',
  'onboarding_acks',
  'sessions',
  'meta',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

export type StoreKey = string | string[];

export interface Store {
  get<T = any>(store: StoreName, key: StoreKey): Promise<T | undefined>;
  getAll<T = any>(store: StoreName): Promise<T[]>;
  /** Documents whose top-level `field` equals one of `values`. */
  find<T = any>(store: StoreName, field: string, values: string[]): Promise<T[]>;
  put(store: StoreName, value: any): Promise<void>;
  /** Insert unless a document with the same key (or unique `offline_uuid`) exists. Returns true when inserted. */
  insertIfAbsent(store: StoreName, value: any): Promise<boolean>;
  delete(store: StoreName, key: StoreKey): Promise<void>;
  /** Remove every document of the given stores (used by the dev reset only). */
  clear(stores: StoreName[]): Promise<void>;
}

export function keyOf(store: StoreName, value: any): string {
  switch (store) {
    case 'sessions':
      return String(value.token);
    case 'meta':
      return String(value.key);
    case 'onboarding_acks':
      return `${value.user_id}:${value.event_id}`;
    default:
      return String(value.id);
  }
}

const normKey = (key: StoreKey) => (Array.isArray(key) ? key.join(':') : key);

const UNIQUE_OFFLINE: StoreName[] = ['observations', 'coverage_marks'];

// ---------------------------------------------------------------------------
// In-memory store (tests)
// ---------------------------------------------------------------------------

export class MemoryStore implements Store {
  private data = new Map<StoreName, Map<string, any>>();

  private table(store: StoreName) {
    let t = this.data.get(store);
    if (!t) this.data.set(store, (t = new Map()));
    return t;
  }

  async get(store: StoreName, key: StoreKey) {
    const v = this.table(store).get(normKey(key));
    return v === undefined ? undefined : structuredClone(v);
  }

  async getAll(store: StoreName) {
    return [...this.table(store).values()].map((v) => structuredClone(v));
  }

  async find(store: StoreName, field: string, values: string[]) {
    const set = new Set(values);
    return [...this.table(store).values()].filter((v) => set.has(v[field])).map((v) => structuredClone(v));
  }

  async put(store: StoreName, value: any) {
    this.table(store).set(keyOf(store, value), structuredClone(value));
  }

  async insertIfAbsent(store: StoreName, value: any) {
    const t = this.table(store);
    const key = keyOf(store, value);
    if (t.has(key)) return false;
    if (UNIQUE_OFFLINE.includes(store) && [...t.values()].some((v) => v.offline_uuid === value.offline_uuid)) return false;
    t.set(key, structuredClone(value));
    return true;
  }

  async delete(store: StoreName, key: StoreKey) {
    this.table(store).delete(normKey(key));
  }

  async clear(stores: StoreName[]) {
    for (const s of stores) this.table(s).clear();
  }
}

// ---------------------------------------------------------------------------
// Postgres (Neon) store
// ---------------------------------------------------------------------------

/** Minimal driver contract: implemented with @neondatabase/serverless in production and PGlite in tests. */
export interface SqlDriver {
  query(text: string, params?: any[]): Promise<any[]>;
  /** Run statements atomically in order. */
  batch(statements: [string, any[]?][]): Promise<void>;
}

const FIELD_RE = /^[a-z_]+$/;
const table = (store: StoreName) => `gera_${store}`;

const INDEXES: [StoreName, string][] = [
  ['users', 'mobile_or_username'],
  ['event_members', 'event_id'],
  ['event_members', 'user_id'],
  ['activities', 'event_id'],
  ['groups', 'event_id'],
  ['participants', 'event_id'],
  ['assignments', 'event_id'],
  ['assignments', 'facilitator_id'],
  ['observations', 'event_id'],
  ['observations', 'facilitator_id'],
  ['coverage_marks', 'event_id'],
  ['sessions', 'user_id'],
];

export function schemaStatements(): [string, any[]?][] {
  const stmts: [string, any[]?][] = STORE_NAMES.map((s) => [
    `CREATE TABLE IF NOT EXISTS ${table(s)} (
       key        TEXT PRIMARY KEY,
       data       JSONB NOT NULL,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  ]);
  for (const [s, f] of INDEXES) {
    stmts.push([`CREATE INDEX IF NOT EXISTS ${table(s)}_${f}_idx ON ${table(s)} ((data->>'${f}'))`]);
  }
  for (const s of UNIQUE_OFFLINE) {
    stmts.push([`CREATE UNIQUE INDEX IF NOT EXISTS ${table(s)}_offline_uuid_uq ON ${table(s)} ((data->>'offline_uuid'))`]);
  }
  stmts.push([`CREATE INDEX IF NOT EXISTS ${table('audit_logs')}_created_idx ON ${table('audit_logs')} ((data->>'created_at') DESC)`]);
  return stmts;
}

export class PgStore implements Store {
  constructor(private driver: SqlDriver) {}

  async migrate() {
    await this.driver.batch(schemaStatements());
  }

  async get(store: StoreName, key: StoreKey) {
    const rows = await this.driver.query(`SELECT data FROM ${table(store)} WHERE key = $1`, [normKey(key)]);
    return rows.length ? rows[0].data : undefined;
  }

  async getAll(store: StoreName) {
    const rows = await this.driver.query(`SELECT data FROM ${table(store)}`);
    return rows.map((r) => r.data);
  }

  async find(store: StoreName, field: string, values: string[]) {
    if (!FIELD_RE.test(field)) throw new Error(`invalid field ${field}`);
    if (values.length === 0) return [];
    const rows = await this.driver.query(`SELECT data FROM ${table(store)} WHERE data->>'${field}' = ANY($1::text[])`, [values]);
    return rows.map((r) => r.data);
  }

  async put(store: StoreName, value: any) {
    await this.driver.query(
      `INSERT INTO ${table(store)} (key, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [keyOf(store, value), JSON.stringify(value)]
    );
  }

  async insertIfAbsent(store: StoreName, value: any) {
    const rows = await this.driver.query(
      `INSERT INTO ${table(store)} (key, data) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING RETURNING key`,
      [keyOf(store, value), JSON.stringify(value)]
    );
    return rows.length > 0;
  }

  async delete(store: StoreName, key: StoreKey) {
    await this.driver.query(`DELETE FROM ${table(store)} WHERE key = $1`, [normKey(key)]);
  }

  async clear(stores: StoreName[]) {
    await this.driver.batch(stores.map((s) => [`DELETE FROM ${table(s)}`] as [string]));
  }
}

// ---------------------------------------------------------------------------
// Active store (set by api entry / tests)
// ---------------------------------------------------------------------------

let activeStore: Store | null = null;

export function setStore(store: Store | null) {
  activeStore = store;
}

export function getStore(): Store {
  if (!activeStore) throw new Error('Store is not initialised');
  return activeStore;
}
