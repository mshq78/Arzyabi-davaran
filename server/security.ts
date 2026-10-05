import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/** scrypt password hashing: `scrypt$<salt hex>$<hash hex>` */
export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 32, (err, key) => (err ? reject(err) : resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`)))
  );
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = (stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return Promise.resolve(false);
  const expected = Buffer.from(hashHex, 'hex');
  return new Promise((resolve) =>
    scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, (err, key) =>
      resolve(!err && key.length === expected.length && timingSafeEqual(key, expected))
    )
  );
}

/** Opaque bearer token handed to the client; only its SHA-256 is stored server-side. */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function randomTempPassword(): string {
  // 10 chars, no look-alike characters
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
