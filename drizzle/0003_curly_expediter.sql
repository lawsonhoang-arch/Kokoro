CREATE TABLE "description_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "description_author_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "description_submissions" ADD CONSTRAINT "description_submissions_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "description_submissions" ADD CONSTRAINT "description_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "description_submissions" ADD CONSTRAINT "description_submissions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "description_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_title_idx" ON "description_submissions" USING btree ("title_id");--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_description_author_id_users_id_fk" FOREIGN KEY ("description_author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;