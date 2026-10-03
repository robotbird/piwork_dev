CREATE TABLE "InferenceAccessAudit" (
	"action" varchar(32) NOT NULL,
	"chatId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"durationMs" integer,
	"errorCode" varchar(32),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inputTokens" integer,
	"model" varchar(128),
	"outputTokens" integer,
	"provider" varchar(64),
	"runId" varchar(64),
	"status" varchar NOT NULL
);
--> statement-breakpoint
CREATE INDEX "InferenceAccessAudit_chatId_idx" ON "InferenceAccessAudit" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX "InferenceAccessAudit_runId_idx" ON "InferenceAccessAudit" USING btree ("runId");