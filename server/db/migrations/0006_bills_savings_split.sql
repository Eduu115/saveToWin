-- Facturas como categoría propia; Ahorro → Ingreso/Retirada cuenta ahorro.
-- NUNCA DELETE de categorías ni de movimientos.

UPDATE "categories" SET "label" = 'Hogar' WHERE "key" = 'Home & bills';
--> statement-breakpoint

UPDATE "categories" SET "label" = 'Ingreso en cuenta ahorro' WHERE "key" = 'Savings transfer';
--> statement-breakpoint

INSERT INTO "categories" ("user_id", "key", "label", "color", "type", "archived")
SELECT u."id", 'Bills', 'Facturas', 'c8', 'expense', false
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."key" = 'Bills'
);
--> statement-breakpoint

INSERT INTO "categories" ("user_id", "key", "label", "color", "type", "archived")
SELECT u."id", 'Savings withdrawal', 'Retirada cuenta ahorro', 'c11', 'savings', false
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."key" = 'Savings withdrawal'
);
