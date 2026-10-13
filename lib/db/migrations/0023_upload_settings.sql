CREATE TABLE "UploadSettings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"maxFileSizeMB" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" uuid
);
--> statement-breakpoint
ALTER TABLE "UploadSettings" ADD CONSTRAINT "UploadSettings_updatedBy_User_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;