import { type Store, STORE_NAMES } from './store.js';
import {
  DEMO_PASSWORD,
  INITIAL_ACTIVITIES,
  INITIAL_ASSIGNMENTS,
  INITIAL_BEHAVIOR_CATALOG,
  INITIAL_EVENT,
  INITIAL_EVENT_MEMBERS,
  INITIAL_GROUPS,
  INITIAL_PARTICIPANTS,
  INITIAL_USERS,
} from './seed.js';
import { hashPassword } from './security.js';
import type { User } from '../src/domain/types.js';

export class ConfigError extends Error {}

/**
 * First-run initialisation (idempotent):
 *  - the 24-behaviour catalogue is inserted when the catalogue is empty
 *  - the first SYSTEM_ADMIN is created from ADMIN_USERNAME (default "admin") / ADMIN_PASSWORD when there are no users
 */
export async function initialiseData(store: Store, env: Record<string, string | undefined> = process.env) {
  const behaviors = await store.getAll('behaviors');
  if (behaviors.length === 0) {
    for (const b of INITIAL_BEHAVIOR_CATALOG) await store.insertIfAbsent('behaviors', b);
  }

  const users = await store.getAll<User>('users');
  if (users.length === 0) {
    const password = env.ADMIN_PASSWORD;
    if (!password || password.length < 8) {
      throw new ConfigError('ADMIN_PASSWORD (min. 8 characters) must be set to create the first administrator.');
    }
    const admin: User = {
      id: 'u-admin',
      full_name: env.ADMIN_FULL_NAME || 'مدیر سامانه',
      mobile_or_username: (env.ADMIN_USERNAME || 'admin').trim(),
      password_hash: await hashPassword(password),
      role: 'SYSTEM_ADMIN',
      status: 'Active',
    };
    await store.insertIfAbsent('users', admin);
  }
}

/** Wipes every collection and loads the demo bootcamp (64 participants, 8 facilitators). Dev tools / tests only. */
export async function seedDemo(store: Store) {
  await store.clear([...STORE_NAMES]);
  const hash = await hashPassword(DEMO_PASSWORD);
  for (const u of INITIAL_USERS) await store.put('users', { ...u, password_hash: hash });
  await store.put('events', INITIAL_EVENT);
  for (const m of INITIAL_EVENT_MEMBERS) await store.put('event_members', m);
  for (const a of INITIAL_ACTIVITIES) await store.put('activities', a);
  for (const g of INITIAL_GROUPS) await store.put('groups', g);
  for (const p of INITIAL_PARTICIPANTS) await store.put('participants', p);
  for (const a of INITIAL_ASSIGNMENTS) await store.put('assignments', a);
  for (const b of INITIAL_BEHAVIOR_CATALOG) await store.put('behaviors', b);
}
