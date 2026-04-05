-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create custom types if they don't exist via Drizzle migrations
-- (Drizzle will handle the actual table creation)
