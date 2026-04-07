CREATE TABLE IF NOT EXISTS "retrieval_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"memory_id" uuid NOT NULL,
	"query_text" text,
	"retrieval_score" real,
	"was_used" boolean DEFAULT false,
	"relevance_feedback" real,
	"session_id" text,
	"actor_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "retrieval_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "last_retrieved_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retrieval_events" ADD CONSTRAINT "retrieval_events_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_events_tenant_id_idx" ON "retrieval_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_events_memory_id_idx" ON "retrieval_events" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_events_created_at_idx" ON "retrieval_events" USING btree ("created_at");