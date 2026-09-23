CREATE TABLE "ModelProviderPlugin" (
	"buildHash" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"credentialSummary" json DEFAULT '{}'::json NOT NULL,
	"definition" json NOT NULL,
	"description" varchar(1024),
	"defaultModelId" varchar(256),
	"displayName" varchar(128) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabledModels" json DEFAULT '[]'::json NOT NULL,
	"encryptedCredentials" text NOT NULL,
	"healthStatus" varchar DEFAULT 'healthy' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packageId" varchar(128) NOT NULL,
	"providerKey" varchar(128) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" varchar(64) NOT NULL,
	CONSTRAINT "ModelProviderPlugin_providerKey_unique" UNIQUE("providerKey")
);
--> statement-breakpoint
DROP TABLE "ModelProvider" CASCADE;--> statement-breakpoint
DROP TABLE "ProviderModel" CASCADE;--> statement-breakpoint
ALTER TABLE "ModelProviderPlugin" ADD CONSTRAINT "ModelProviderPlugin_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;