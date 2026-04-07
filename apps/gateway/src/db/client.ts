import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '../config.js';
import * as schema from './schema.js';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (env.DATABASE_URL) {
  const sql = neon(env.DATABASE_URL);
  dbInstance = drizzle(sql, { schema });
}

export const db = dbInstance;
