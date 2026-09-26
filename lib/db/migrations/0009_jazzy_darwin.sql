CREATE TABLE "AgentRun" (
	"backend" varchar DEFAULT 'in_process' NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"endedAt" timestamp,
	"errorMessage" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"startedAt" timestamp,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RuntimeEvent" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"data" json NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runId" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RuntimeLease" (
	"acquiredAt" timestamp DEFAULT now() NOT NULL,
	"heartbeatAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runId" uuid NOT NULL,
	"workerId" varchar(128) NOT NULL,
	CONSTRAINT "RuntimeLease_runId_unique" UNIQUE("runId")
);
--> statement-breakpoint
DROP TABLE "Stream" CASCADE;--> statement-breakpoint
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RuntimeEvent" ADD CONSTRAINT "RuntimeEvent_runId_AgentRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."AgentRun"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RuntimeLease" ADD CONSTRAINT "RuntimeLease_runId_AgentRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."AgentRun"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AgentRun_chatId_idx" ON "AgentRun" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "RuntimeEvent_runId_seq_key" ON "RuntimeEvent" USING btree ("runId","seq");