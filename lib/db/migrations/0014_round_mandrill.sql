CREATE TABLE "SandboxInstance" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"chatId" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"externalId" varchar(256) NOT NULL,
	"image" varchar(256) NOT NULL,
	"lastRenewedAt" timestamp DEFAULT now() NOT NULL,
	"lastRunId" uuid,
	"provider" varchar NOT NULL,
	"status" varchar DEFAULT 'creating' NOT NULL,
	"ttlSeconds" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SandboxInstance" ADD CONSTRAINT "SandboxInstance_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SandboxInstance" ADD CONSTRAINT "SandboxInstance_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "SandboxInstance_chatId_idx" ON "SandboxInstance" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "SandboxInstance_provider_externalId_key" ON "SandboxInstance" USING btree ("provider","externalId");