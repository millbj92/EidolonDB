import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export type GeneratedApiKey = {
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
};

export async function generateApiKey(): Promise<GeneratedApiKey> {
  const raw = crypto.randomBytes(16).toString('hex');
  const fullKey = `eid_live_${raw}`;
  const keyHash = await bcrypt.hash(fullKey, 10);
  const keyPrefix = `${fullKey.slice(0, 16)}...`;

  return { fullKey, keyHash, keyPrefix };
}

export function sanitizeSlug(source: string): string {
  const clean = source
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return clean || 'tenant';
}
