CREATE TABLE "Department" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leaderId" uuid,
	"name" varchar(128) NOT NULL,
	"parentId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Member" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"departmentId" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar DEFAULT 'member' NOT NULL,
	"status" varchar DEFAULT 'enabled' NOT NULL,
	"title" varchar(128),
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "Member_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "Department" ADD CONSTRAINT "Department_leaderId_Member_id_fk" FOREIGN KEY ("leaderId") REFERENCES "public"."Member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_Department_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."Department"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Member" ADD CONSTRAINT "Member_departmentId_Department_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;