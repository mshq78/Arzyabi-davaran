import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleRequest, ApiError } from '../server/handler.js';
import { getNeonStore } from '../server/neon.js';
import { ConfigError } from '../server/bootstrap.js';
import { setStore } from '../server/store.js';

/**
 * Single entry point for every `/api/*` route (via the rewrite in vercel.json) (see server/handler.ts for the route table).
 * Authorization: `Authorization: Bearer <token>` issued by POST /api/auth/login.
 *
 * Required env: DATABASE_URL (or POSTGRES_URL), ADMIN_PASSWORD (first administrator).
 * Optional env: ADMIN_USERNAME, ADMIN_FULL_NAME, ENABLE_DEV_TOOLS.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const send = (status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

  // Diagnostics (public, no data): GET /api/health
  const requested = (Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path ?? '')).replace(/^\/+|\/+$/g, '');
  if (requested === 'health') {
    const out: Record<string, unknown> = {
      ok: false,
      time: new Date().toISOString(),
      env: {
        database_url: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        admin_password: Boolean(process.env.ADMIN_PASSWORD),
      },
    };
    try {
      const store = await getNeonStore();
      out.db = 'ok';
      out.bootstrapped = {
        behaviors: (await store.getAll('behaviors')).length > 0,
        admin_user: (await store.getAll('users')).length > 0,
      };
      out.ok = true;
    } catch (err: any) {
      console.error('health check failed', err);
      out.db = err instanceof ConfigError ? 'not_configured' : 'error';
    }
    return res.status(out.ok ? 200 : 503).json(out);
  }

  try {
    setStore(await getNeonStore());

    const method = (req.method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return send(405, 'METHOD_NOT_ALLOWED', 'متد مجاز نیست.');

    // vercel.json rewrites /api/:path* -> /api/index?path=:path* (a bare catch-all file does not route nested paths)
    const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path ?? '');
    const segments = rawPath.split('/').filter(Boolean);
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue;
      for (const item of Array.isArray(v) ? v : [v]) if (item !== undefined) query.append(k, String(item));
    }
    const path = '/' + segments.join('/') + (query.toString() ? `?${query}` : '');

    const header = req.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;

    const data = await handleRequest(method, path, req.body, token);
    return res.status(200).json(data === undefined ? { success: true } : data);
  } catch (err: any) {
    if (err instanceof ApiError) return send(err.status, err.code, err.message);
    if (err instanceof ConfigError) {
      console.error('config error', err.message);
      return send(503, 'NOT_CONFIGURED', 'سامانه هنوز پیکربندی نشده است (ADMIN_PASSWORD).');
    }
    console.error('api error', err);
    return send(500, 'INTERNAL_ERROR', 'خطای سرور رخ داد.');
  }
}
