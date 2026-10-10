CREATE TABLE "SandboxSettings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"cpuCores" double precision NOT NULL,
	"memoryMB" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" uuid
);
--> statement-breakpoint
ALTER TABLE "SandboxSettings" ADD CONSTRAINT "SandboxSettings_updatedBy_User_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;