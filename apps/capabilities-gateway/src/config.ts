import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  USERS_DATABASE_URL: z.string().optional(),
  CAPABILITIES_INTERNAL_URL: z.string().default('http://localhost:4000'),
  GATEWAY_SERVICE_KEY: z.string().optional(),
  DEV_BYPASS_AUTH: z.string().optional().transform(v => v === 'true' || v === '1').default('false' as never),
  DEV_TENANT_ID: z.string().default('default'),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
