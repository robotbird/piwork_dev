CREATE TABLE "McpServer" (
	"args" json DEFAULT '[]'::json NOT NULL,
	"command" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"description" varchar(1024) DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"env" json DEFAULT '{}'::json NOT NULL,
	"headers" json DEFAULT '{}'::json NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"transport" varchar NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"url" varchar(1024),
	CONSTRAINT "McpServer_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;