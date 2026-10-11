CREATE TABLE "ProjectCollaborator" (
	"projectId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitedBy" uuid,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProjectShareInvite" (
	"projectId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revokedAt" timestamp,
	"tokenHash" varchar(64) NOT NULL,
	CONSTRAINT "ProjectShareInvite_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_invitedBy_User_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectShareInvite" ADD CONSTRAINT "ProjectShareInvite_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectShareInvite" ADD CONSTRAINT "ProjectShareInvite_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ProjectCollaborator_chat_user_idx" ON "ProjectCollaborator" USING btree ("projectId","userId");--> statement-breakpoint
CREATE INDEX "ProjectCollaborator_user_idx" ON "ProjectCollaborator" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ProjectShareInvite_chat_idx" ON "ProjectShareInvite" USING btree ("projectId");