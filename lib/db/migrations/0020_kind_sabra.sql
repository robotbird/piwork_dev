CREATE TABLE "ChatCollaborator" (
	"chatId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitedBy" uuid,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChatShareInvite" (
	"chatId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revokedAt" timestamp,
	"tokenHash" varchar(64) NOT NULL,
	CONSTRAINT "ChatShareInvite_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "forkedFromChatId" uuid;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "userId" uuid;--> statement-breakpoint
ALTER TABLE "ChatCollaborator" ADD CONSTRAINT "ChatCollaborator_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChatCollaborator" ADD CONSTRAINT "ChatCollaborator_invitedBy_User_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChatCollaborator" ADD CONSTRAINT "ChatCollaborator_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChatShareInvite" ADD CONSTRAINT "ChatShareInvite_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChatShareInvite" ADD CONSTRAINT "ChatShareInvite_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ChatCollaborator_chat_user_idx" ON "ChatCollaborator" USING btree ("chatId","userId");--> statement-breakpoint
CREATE INDEX "ChatCollaborator_user_idx" ON "ChatCollaborator" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ChatShareInvite_chat_idx" ON "ChatShareInvite" USING btree ("chatId");--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_forkedFromChatId_Chat_id_fk" FOREIGN KEY ("forkedFromChatId") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;