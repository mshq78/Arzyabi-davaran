import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { handleRequest } from '../../server/handler';
import { MemoryStore, PgStore, SqlDriver, setStore, Store } from '../../server/store';
import { initialiseData, seedDemo, ConfigError } from '../../server/bootstrap';
import { hashPassword, verifyPassword } from '../../server/security';

/** Runs real Postgres semantics (PGlite) behind the same SqlDriver contract the Neon driver implements. */
function pgliteDriver(db: PGlite): SqlDriver {
  return {
    query: async (text, params = []) => (await db.query(text, params)).rows as any[],
    batch: async (stmts) => {
      await db.transaction(async (tx) => {
        for (const [text, params] of stmts) await tx.query(text, params ?? []);
      });
    },
  };
}

async function newPgStore() {
  const store = new PgStore(pgliteDriver(new PGlite()));
  await store.migrate();
  await store.migrate(); // idempotent
  return store;
}

describe('PgStore (Postgres)', () => {
  let store: PgStore;
  beforeAll(async () => {
    store = await newPgStore();
  });

  it('round-trips documents, composite keys and field lookups', async () => {
    await store.put('events', { id: 'e1', title: 'A' });
    await store.put('events', { id: 'e1', title: 'B' });
    expect((await store.get('events', 'e1')).title).toBe('B');
    expect(await store.getAll('events')).toHaveLength(1);

    await store.put('onboarding_acks', { user_id: 'u1', event_id: 'e1', acked_at: 'x' });
    expect((await store.get('onboarding_acks', ['u1', 'e1'])).acked_at).toBe('x');

    await store.put('participants', { id: 'p1', event_id: 'e1' });
    await store.put('participants', { id: 'p2', event_id: 'e2' });
    expect((await store.find('participants', 'event_id', ['e1'])).map((p: any) => p.id)).toEqual(['p1']);
    expect(await store.find('participants', 'event_id', [])).toEqual([]);
    await expect(store.find('participants', "x'; DROP TABLE", ['a'])).rejects.toThrow();

    await store.delete('events', 'e1');
    expect(await store.get('events', 'e1')).toBeUndefined();
  });

  it('enforces a unique offline_uuid (idempotent concurrent inserts)', async () => {
    const mk = (id: string) => ({ id, offline_uuid: 'same-uuid', event_id: 'e1' });
    const results = await Promise.all([store.insertIfAbsent('observations', mk('o1')), store.insertIfAbsent('observations', mk('o2'))]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.getAll('observations')).toHaveLength(1);
  });

  it('runs the whole API on Postgres: first-run bootstrap, login, sessions, sync batch', async () => {
    const pg = await newPgStore();
    setStore(pg);
    await expect(initialiseData(pg, {})).rejects.toBeInstanceOf(ConfigError);
    await initialiseData(pg, { ADMIN_PASSWORD: 'a-long-password', ADMIN_USERNAME: 'boss' });
    await initialiseData(pg, { ADMIN_PASSWORD: 'other-password' }); // no second admin
    expect(await pg.getAll('users')).toHaveLength(1);
    expect(await pg.getAll('behaviors')).toHaveLength(24);

    await expect(handleRequest('POST', '/auth/login', { mobile_or_username: 'boss', password: 'wrong' })).rejects.toMatchObject({ status: 401 });
    const login = await handleRequest('POST', '/auth/login', { mobile_or_username: 'boss', password: 'a-long-password' });
    expect(login.user.role).toBe('SYSTEM_ADMIN');
    expect((await handleRequest('GET', '/me', undefined, login.token)).user.mobile_or_username).toBe('boss');

    // only the hash of the token is stored
    const sessions = (await pg.getAll('sessions')) as any[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token).not.toBe(login.token);

    await handleRequest('POST', '/auth/logout', {}, login.token);
    await expect(handleRequest('GET', '/me', undefined, login.token)).rejects.toMatchObject({ status: 401 });
  });
});

describe('Auth hardening', () => {
  let store: Store;
  beforeAll(async () => {
    process.env.ENABLE_DEV_TOOLS = 'true';
    store = new MemoryStore();
    setStore(store);
    await seedDemo(store);
  });

  it('hashes passwords with scrypt and verifies them', async () => {
    const h = await hashPassword('s3cret-pass');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('s3cret-pass', h)).toBe(true);
    expect(await verifyPassword('nope', h)).toBe(false);
    expect(await verifyPassword('x', 'h_1234')).toBe(false); // legacy / malformed hash never matches
  });

  it('locks a username after 5 failed attempts within a minute (persisted, not in memory)', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(handleRequest('POST', '/auth/login', { mobile_or_username: 'fac3', password: 'bad' })).rejects.toMatchObject({ status: 401 });
    }
    await expect(handleRequest('POST', '/auth/login', { mobile_or_username: 'fac3', password: 'demo1234' })).rejects.toMatchObject({ status: 429 });
  });

  it('never returns or stores temporary passwords in clear text', async () => {
    const admin = (await handleRequest('POST', '/auth/login', { mobile_or_username: 'sysadmin', password: 'demo1234' })).token;
    const reset = await handleRequest('POST', '/admin/users/u-fac4/reset-password', {}, admin);
    expect(reset.temp_password.length).toBeGreaterThanOrEqual(10);
    const users = await handleRequest('GET', '/admin/users', undefined, admin);
    expect(JSON.stringify(users)).not.toContain(reset.temp_password);
    expect(JSON.stringify(await store.getAll('users'))).not.toContain(reset.temp_password);
    expect(await handleRequest('POST', '/auth/login', { mobile_or_username: 'fac4', password: reset.temp_password })).toHaveProperty('token');
  });

  it('rejects short passwords and invalid roles when creating users', async () => {
    const admin = (await handleRequest('POST', '/auth/login', { mobile_or_username: 'sysadmin', password: 'demo1234' })).token;
    await expect(
      handleRequest('POST', '/admin/users', { full_name: 'X', mobile_or_username: 'x1', password: 'short', role: 'FACILITATOR' }, admin)
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      handleRequest('POST', '/admin/users', { full_name: 'X', mobile_or_username: 'x1', password: 'long-enough-pw', role: 'ROOT' }, admin)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('hides /dev endpoints unless ENABLE_DEV_TOOLS=true', async () => {
    const admin = (await handleRequest('POST', '/auth/login', { mobile_or_username: 'sysadmin', password: 'demo1234' })).token;
    process.env.ENABLE_DEV_TOOLS = 'false';
    await expect(handleRequest('POST', '/dev/reset-database', {}, admin)).rejects.toMatchObject({ status: 404 });
    process.env.ENABLE_DEV_TOOLS = 'true';
  });
});
