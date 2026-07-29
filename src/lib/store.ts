import { resolveSessionStorage } from "../toolkit/session/redis.js";

// The adapter is Redis-backed whenever the toolkit is configured with REDIS_URL.
// Keys below are deliberate indexes; this module never scans a Redis keyspace.
const storage = resolveSessionStorage<Record<string, unknown>>(undefined);

export async function read<T>(key: string): Promise<T | undefined> {
  return (await storage.read(`id-generator:${key}`)) as T | undefined;
}

export async function write<T>(key: string, value: T): Promise<void> {
  await storage.write(`id-generator:${key}`, value as Record<string, unknown>);
}

export async function remove(key: string): Promise<void> {
  await storage.delete(`id-generator:${key}`);
}
