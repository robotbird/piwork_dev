CREATE TABLE "LibraryItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"parentId" uuid,
	"name" text NOT NULL,
	"kind" varchar NOT NULL,
	"source" varchar NOT NULL,
	"url" text,
	"contentType" text,
	"size" integer DEFAULT 0 NOT NULL,
	"documentId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_parentId_LibraryItem_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."LibraryItem"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "LibraryItem_user_parent_idx" ON "LibraryItem" USING btree ("userId","parentId");--> statement-breakpoint
CREATE UNIQUE INDEX "LibraryItem_user_url_idx" ON "LibraryItem" USING btree ("userId","url");--> statement-breakpoint
INSERT INTO "LibraryItem" ("id", "userId", "documentId", "name", "kind", "source", "contentType", "size", "createdAt", "updatedAt")
SELECT DISTINCT ON ("id") "id", "userId", "id", "title" || CASE "text" WHEN 'sheet' THEN '.csv' WHEN 'code' THEN '.txt' WHEN 'image' THEN '.png' ELSE '.md' END,
'file', 'ai', CASE "text" WHEN 'sheet' THEN 'text/csv' WHEN 'image' THEN 'image/png' ELSE 'text/plain' END,
octet_length(coalesce("content", '')), "createdAt", "createdAt"
FROM "Document" ORDER BY "id", "createdAt" DESC
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "LibraryItem" ("userId", "name", "kind", "source", "url", "contentType", "createdAt", "updatedAt")
SELECT c."userId", coalesce(p->>'filename', p->'data'->>'filename', '附件'), 'file',
CASE WHEN p->>'type' = 'data-delivered-file' THEN 'ai' ELSE 'upload' END,
coalesce(p->>'url', p->'data'->>'url'), coalesce(p->>'mediaType', p->'data'->>'contentType', 'application/octet-stream'), m."createdAt", m."createdAt"
FROM "Message_v2" m JOIN "Chat" c ON c."id" = m."chatId", json_array_elements(m."parts") p
WHERE p->>'type' IN ('file', 'data-delivered-file') AND coalesce(p->>'url', p->'data'->>'url') IS NOT NULL
ON CONFLICT DO NOTHING;
