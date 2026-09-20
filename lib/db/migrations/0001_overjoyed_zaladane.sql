CREATE TABLE "Skill" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"description" varchar(1024) NOT NULL,
	"displayName" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"name" varchar(64) PRIMARY KEY NOT NULL,
	"relativePath" text NOT NULL,
	"source" varchar NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"uploadedBy" uuid,
	"version" varchar(64) DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_uploadedBy_User_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
