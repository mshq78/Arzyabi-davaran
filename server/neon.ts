import { neon } from '@neondatabase/serverless';
import { PgStore, type SqlDriver } from './store.js';

export function neonDriver(connectionString: string): SqlDriver {
  const sql = neon(connectionString);
  return {
    query: (text, params = []) => sql.query(text, params) as Promise<any[]>,
    batch: async (statements) => {
      await sql.transaction((txn) => statements.map(([text, params]) => txn.query(text, params ?? [])));
    },
  };
}

let ready: Promise<PgStore> | null = null;

/** Lazily connects, creates the tables on first use of a cold instance and seeds the catalogue / first admin. */
export function getNeonStore(): Promise<PgStore> {
  if (!ready) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) return Promise.reject(new Error('DATABASE_URL is not configured'));
    ready = (async () => {
      const store = new PgStore(neonDriver(url));
      await store.migrate();
      const { initialiseData } = await import('./bootstrap.js');
      await initialiseData(store);
      return store;
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
