ALTER TABLE "memories" ADD COLUMN "session_number" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_tenant_session_number_idx" ON "memories" USING btree ("tenant_id","session_number");
