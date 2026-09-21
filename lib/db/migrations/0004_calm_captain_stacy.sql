CREATE TABLE "ModelProvider" (
	"apiKey" text NOT NULL,
	"baseUrl" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"description" varchar(1024),
	"enabled" boolean DEFAULT true NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"protocol" varchar DEFAULT 'openai-compatible' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ModelProvider_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ProviderModel" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"modelId" varchar(256) NOT NULL,
	"name" varchar(128) NOT NULL,
	"providerId" uuid NOT NULL,
	"type" varchar DEFAULT 'chat' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProviderModel_providerId_modelId_unique" UNIQUE("providerId","modelId")
);
--> statement-breakpoint
ALTER TABLE "ProviderModel" ADD CONSTRAINT "ProviderModel_providerId_ModelProvider_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."ModelProvider"("id") ON DELETE cascade ON UPDATE no action;