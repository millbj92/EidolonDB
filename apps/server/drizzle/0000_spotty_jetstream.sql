CREATE TYPE "public"."memory_tier" AS ENUM('short_term', 'episodic', 'semantic');--> statement-breakpoint
CREATE TYPE "public"."node_type" AS ENUM('entity', 'artifact', 'memory');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('memory', 'artifact', 'entity');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"model" text NOT NULL,
	"dim" integer NOT NULL,
	"vector" vector(1536),
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"primary_artifact_id" uuid,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_entity_id" uuid,
	"event_type" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"tags" text[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingest_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"trace_id" uuid NOT NULL,
	"raw_input" text NOT NULL,
	"normalized_input" text NOT NULL,
	"source" text NOT NULL,
	"actor_id" text,
	"session_id" text,
	"extractor_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb,
	"warnings" text[] DEFAULT '{}',
	"errors" text[] DEFAULT '{}',
	"duration_ms" integer,
	"auto_store" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingest_traces_trace_id_unique" UNIQUE("trace_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_entity_id" uuid,
	"tier" "memory_tier" NOT NULL,
	"content" text NOT NULL,
	"source_artifact_id" uuid,
	"source_event_id" uuid,
	"embedding_id" uuid,
	"importance_score" real DEFAULT 0.5,
	"recency_score" real DEFAULT 1,
	"access_count" integer DEFAULT 0,
	"last_accessed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"type" text NOT NULL,
	"from_type" "node_type" NOT NULL,
	"from_id" uuid NOT NULL,
	"to_type" "node_type" NOT NULL,
	"to_id" uuid NOT NULL,
	"weight" real,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_actor_entity_id_entities_id_fk" FOREIGN KEY ("actor_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_owner_entity_id_entities_id_fk" FOREIGN KEY ("owner_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_source_artifact_id_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_tenant_id_idx" ON "artifacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_kind_idx" ON "artifacts" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embeddings_tenant_id_idx" ON "embeddings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embeddings_owner_idx" ON "embeddings" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_tenant_id_idx" ON "entities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_type_idx" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_tenant_id_idx" ON "events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_actor_entity_id_idx" ON "events" USING btree ("actor_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_event_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_timestamp_idx" ON "events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingest_traces_tenant_id_idx" ON "ingest_traces" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingest_traces_trace_id_idx" ON "ingest_traces" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingest_traces_created_at_idx" ON "ingest_traces" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_tenant_id_idx" ON "memories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_owner_entity_id_idx" ON "memories" USING btree ("owner_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_tier_idx" ON "memories" USING btree ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relations_tenant_id_idx" ON "relations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relations_from_idx" ON "relations" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relations_to_idx" ON "relations" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relations_type_idx" ON "relations" USING btree ("type");