CREATE TABLE "PiPackage" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installedSkills" json DEFAULT '[]'::json NOT NULL,
	"installedPath" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"resourceSummary" json NOT NULL,
	"source" varchar(256) NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" varchar(64) DEFAULT '' NOT NULL,
	CONSTRAINT "PiPackage_source_unique" UNIQUE("source")
);
--> statement-breakpoint
ALTER TABLE "Skill" ADD COLUMN "sourcePackage" varchar(256);--> statement-breakpoint
ALTER TABLE "PiPackage" ADD CONSTRAINT "PiPackage_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;