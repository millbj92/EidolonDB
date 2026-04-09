import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

// This script is run automatically by CI (.github/workflows/migrate.yml) on push to main
// when schema changes. To run locally: pnpm db:migrate (requires USERS_DATABASE_URL in .env)
async function runMigration(): Promise<void> {
  const databaseUrl = process.env['USERS_DATABASE_URL'];

  if (!databaseUrl) {
    console.error('USERS_DATABASE_URL is required to run migrations.');
    process.exit(1);
  }

  const db = drizzle(neon(databaseUrl));

  await migrate(db, {
    migrationsFolder: './drizzle',
  });

  console.log('Migrations applied successfully.');
}

runMigration().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
