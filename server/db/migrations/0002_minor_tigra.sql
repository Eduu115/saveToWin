-- 'savings' se añade en client.ts (autocommit) antes de migrate().
ALTER TABLE "categories" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
