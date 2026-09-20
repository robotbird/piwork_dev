CREATE TABLE "MemberRole" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"memberId" uuid NOT NULL,
	"roleId" uuid NOT NULL,
	CONSTRAINT "MemberRole_memberId_roleId_pk" PRIMARY KEY("memberId","roleId")
);
--> statement-breakpoint
CREATE TABLE "Role" (
	"code" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"description" varchar(1024),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memberLimit" integer,
	"name" varchar(128) NOT NULL,
	"type" varchar DEFAULT 'custom' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Role_code_unique" UNIQUE("code"),
	CONSTRAINT "Role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_memberId_Member_id_fk" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_roleId_Role_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE cascade ON UPDATE no action;