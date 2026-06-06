ALTER TABLE "titles" ADD COLUMN "search_text" text;--> statement-breakpoint
-- Self-hosted fuzzy search: trigram matching over title + synonyms.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "titles_search_trgm_idx" ON "titles" USING gin ("search_text" gin_trgm_ops);
