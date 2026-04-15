CREATE TYPE "public"."grant_permission" AS ENUM('read', 'read-write');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_entity_id" uuid NOT NULL,
	"grantee_entity_id" uuid,
	"permission" "grant_permission" DEFAULT 'read' NOT NULL,
	"scope_tier" "memory_tier",
	"scope_tag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "session_number" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_grants" ADD CONSTRAINT "memory_grants_owner_entity_id_entities_id_fk" FOREIGN KEY ("owner_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_grants" ADD CONSTRAINT "memory_grants_grantee_entity_id_entities_id_fk" FOREIGN KEY ("grantee_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_grants_tenant_idx" ON "memory_grants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_grants_owner_idx" ON "memory_grants" USING btree ("owner_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_grants_grantee_idx" ON "memory_grants" USING btree ("grantee_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_tenant_session_number_idx" ON "memories" USING btree ("tenant_id","session_number");