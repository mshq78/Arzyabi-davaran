import { describe, it, expect, vi, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PgStore } from '../../server/store';
import { initialiseData } from '../../server/bootstrap';

let store: PgStore;
vi.mock('../../server/neon', () => ({ getNeonStore: async () => store }));

import handler from '../../api/[...path]';

function call(method: string, path: string[], opts: { body?: any; token?: string; query?: Record<string, string> } = {}) {
  return new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve) => {
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader: (k: string, v: string) => (headers[k] = v),
      status(code: number) {
        res.code = code;
        return res;
      },
      json(body: any) {
        resolve({ status: res.code, body, headers });
      },
    };
    const req: any = {
      method,
      query: { path, ...(opts.query || {}) },
      body: opts.body,
      headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    };
    handler(req, res);
  });
}

describe('api/[...path] entry', () => {
  beforeAll(async () => {
    const db = new PGlite();
    store = new PgStore({
      query: async (t, p = []) => (await db.query(t, p)).rows as any[],
      batch: async (stmts) => {
        await db.transaction(async (tx) => {
          for (const [t, p] of stmts) await tx.query(t, p ?? []);
        });
      },
    });
    await store.migrate();
    await initialiseData(store, { ADMIN_PASSWORD: 'a-long-password' });
  });

  it('routes login -> authenticated requests and maps errors to { error: { code, message } }', async () => {
    const bad = await call('POST', ['auth', 'login'], { body: { mobile_or_username: 'admin', password: 'nope-nope' } });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(bad.headers['Cache-Control']).toBe('no-store');

    const ok = await call('POST', ['auth', 'login'], { body: { mobile_or_username: 'admin', password: 'a-long-password' } });
    expect(ok.status).toBe(200);

    const me = await call('GET', ['me'], { token: ok.body.token });
    expect(me.body.user.role).toBe('SYSTEM_ADMIN');

    const nested = await call('GET', ['admin', 'behaviors'], { token: ok.body.token });
    expect(nested.body).toHaveLength(24);

    expect((await call('GET', ['me'])).status).toBe(401);
    expect((await call('GET', ['nope'], { token: ok.body.token })).status).toBe(404);
    expect((await call('POST', ['dev', 'reset-database'], { token: ok.body.token, body: {} })).status).toBe(404);
  });
});
