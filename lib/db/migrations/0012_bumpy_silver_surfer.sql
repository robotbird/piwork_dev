CREATE TABLE "ScheduledTaskRun" (
	"id" uuid PRIMARY KEY NOT NULL,
	"taskId" uuid NOT NULL,
	"chatId" uuid,
	"status" varchar NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"finishedAt" timestamp,
	"errorMessage" text
);
--> statement-breakpoint
ALTER TABLE "ScheduledTask" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ScheduledTask" ADD COLUMN "leaseToken" uuid;--> statement-breakpoint
ALTER TABLE "ScheduledTask" ADD COLUMN "lockedUntil" timestamp;--> statement-breakpoint
ALTER TABLE "ScheduledTaskRun" ADD CONSTRAINT "ScheduledTaskRun_taskId_ScheduledTask_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."ScheduledTask"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ScheduledTaskRun" ADD CONSTRAINT "ScheduledTaskRun_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ScheduledTaskRun_task_idx" ON "ScheduledTaskRun" USING btree ("taskId","startedAt");
--> statement-breakpoint
UPDATE "ScheduledTask" SET "enabled" = false, "nextRunAt" = NULL WHERE "status" = 'cancelled';
