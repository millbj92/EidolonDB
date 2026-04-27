import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config.js';
import * as schema from './schema.js';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (env.USERS_DATABASE_URL) {
  const pool = new Pool({ connectionString: env.USERS_DATABASE_URL });
  dbInstance = drizzle(pool, { schema });
}

export const db = dbInstance;
