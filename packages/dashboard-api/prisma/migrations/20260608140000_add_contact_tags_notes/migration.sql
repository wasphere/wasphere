-- CRM fields for the contact book: tags (labels) and a free-form note.
ALTER TABLE "contacts" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "contacts" ADD COLUMN "notes" TEXT;

-- GIN index so tag filtering (tags @> ARRAY[...]) stays fast.
CREATE INDEX "contacts_tags_idx" ON "contacts" USING GIN ("tags");
