CREATE TABLE IF NOT EXISTS "lifecycle_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"triggered_by" text DEFAULT 'manual' NOT NULL,
	"duration_ms" integer,
	"expired" integer DEFAULT 0 NOT NULL,
	"promoted" integer DEFAULT 0 NOT NULL,
	"distilled" integer DEFAULT 0 NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"unchanged" integer DEFAULT 0 NOT NULL,
	"errors" text[] DEFAULT '{}',
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lifecycle_runs_tenant_id_idx" ON "lifecycle_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lifecycle_runs_created_at_idx" ON "lifecycle_runs" USING btree ("created_at");