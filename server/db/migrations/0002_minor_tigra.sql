ALTER TYPE "public"."flow_type" ADD VALUE 'savings';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Categorías: renombrar Digital, insertar nuevas, reasignar FKs, archivar Tech/Shopping.
-- NUNCA DELETE de categorías ni de movimientos.

-- 1) Renombrar Digital & games
UPDATE "categories"
SET "label" = 'Tecnología, digital y juegos'
WHERE "key" = 'Digital & games';

--> statement-breakpoint

-- 2) Clothing (Prendas) y Leisure (Ocio) por usuario que aún no las tenga
INSERT INTO "categories" ("user_id", "key", "label", "color", "type", "archived")
SELECT u."id", 'Clothing', 'Prendas', 'c7', 'expense', false
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."key" = 'Clothing'
);

--> statement-breakpoint

INSERT INTO "categories" ("user_id", "key", "label", "color", "type", "archived")
SELECT u."id", 'Leisure', 'Ocio', 'c4', 'expense', false
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."key" = 'Leisure'
);

--> statement-breakpoint

-- 3) Categoría de tipo savings para movimientos a la hucha
INSERT INTO "categories" ("user_id", "key", "label", "color", "type", "archived")
SELECT u."id", 'Savings transfer', 'Ahorro', 'c11', 'savings', false
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."key" = 'Savings transfer'
);

--> statement-breakpoint

-- 4) Reasignar movimientos Tech → Digital & games (mismo user)
UPDATE "transactions" t
SET "category_id" = dig."id"
FROM "categories" tech
JOIN "categories" dig
  ON dig."user_id" = tech."user_id" AND dig."key" = 'Digital & games'
WHERE t."category_id" = tech."id" AND tech."key" = 'Tech';

--> statement-breakpoint

-- 5) Reasignar presupuestos Tech → Digital & games (si ya hay presupuesto en Digital, sumar límites)
UPDATE "budgets" b
SET "limit_cents" = b."limit_cents" + tech_b."limit_cents"
FROM "budgets" tech_b
JOIN "categories" tech ON tech."id" = tech_b."category_id" AND tech."key" = 'Tech'
JOIN "categories" dig ON dig."user_id" = tech."user_id" AND dig."key" = 'Digital & games'
JOIN "budgets" dig_b ON dig_b."category_id" = dig."id" AND dig_b."period" = tech_b."period" AND dig_b."user_id" = tech_b."user_id"
WHERE b."id" = dig_b."id";

--> statement-breakpoint

-- Mover presupuestos Tech sin pareja Digital al Digital
UPDATE "budgets" b
SET "category_id" = dig."id"
FROM "categories" tech
JOIN "categories" dig ON dig."user_id" = tech."user_id" AND dig."key" = 'Digital & games'
WHERE b."category_id" = tech."id"
  AND tech."key" = 'Tech'
  AND NOT EXISTS (
    SELECT 1 FROM "budgets" x
    WHERE x."user_id" = b."user_id" AND x."period" = b."period" AND x."category_id" = dig."id"
  );

--> statement-breakpoint

-- 6) Reasignar movimientos Shopping → Clothing
UPDATE "transactions" t
SET "category_id" = cloth."id"
FROM "categories" shop
JOIN "categories" cloth
  ON cloth."user_id" = shop."user_id" AND cloth."key" = 'Clothing'
WHERE t."category_id" = shop."id" AND shop."key" = 'Shopping';

--> statement-breakpoint

UPDATE "budgets" b
SET "limit_cents" = b."limit_cents" + shop_b."limit_cents"
FROM "budgets" shop_b
JOIN "categories" shop ON shop."id" = shop_b."category_id" AND shop."key" = 'Shopping'
JOIN "categories" cloth ON cloth."user_id" = shop."user_id" AND cloth."key" = 'Clothing'
JOIN "budgets" cloth_b ON cloth_b."category_id" = cloth."id" AND cloth_b."period" = shop_b."period" AND cloth_b."user_id" = shop_b."user_id"
WHERE b."id" = cloth_b."id";

--> statement-breakpoint

UPDATE "budgets" b
SET "category_id" = cloth."id"
FROM "categories" shop
JOIN "categories" cloth ON cloth."user_id" = shop."user_id" AND cloth."key" = 'Clothing'
WHERE b."category_id" = shop."id"
  AND shop."key" = 'Shopping'
  AND NOT EXISTS (
    SELECT 1 FROM "budgets" x
    WHERE x."user_id" = b."user_id" AND x."period" = b."period" AND x."category_id" = cloth."id"
  );

--> statement-breakpoint

-- 7) Archivar Tech y Shopping (filas conservadas; UI las oculta)
UPDATE "categories"
SET "archived" = true,
    "label" = CASE
      WHEN "key" = 'Tech' THEN 'Tecnología (archivada)'
      WHEN "key" = 'Shopping' THEN 'Compras (archivada)'
      ELSE "label"
    END
WHERE "key" IN ('Tech', 'Shopping');
