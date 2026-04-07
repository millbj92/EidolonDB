import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().optional(),
  EIDOLONDB_INTERNAL_URL: z.string().default('http://localhost:3000'),
  DEV_BYPASS_AUTH: z.coerce.boolean().default(false),
  DEV_TENANT_ID: z.string().default('openclaw'),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
