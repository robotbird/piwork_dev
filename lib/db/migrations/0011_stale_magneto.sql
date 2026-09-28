CREATE TABLE "ScheduledTask" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid,
	"taskType" varchar(64) NOT NULL,
	"prompt" text NOT NULL,
	"schedule" json NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"lastRunAt" timestamp,
	"nextRunAt" timestamp,
	"lastResult" text,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ScheduledTask" ADD CONSTRAINT "ScheduledTask_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ScheduledTask_user_idx" ON "ScheduledTask" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ScheduledTask_nextRunAt_idx" ON "ScheduledTask" USING btree ("nextRunAt");--> statement-breakpoint
CREATE INDEX "ScheduledTask_status_idx" ON "ScheduledTask" USING btree ("status");