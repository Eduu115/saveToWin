-- Perfil: 2FA (TOTP) opcional y códigos de confirmación por correo.
-- Solo añade columnas/tablas: no toca datos existentes.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_recovery" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "auth_codes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "purpose" text NOT NULL CHECK ("purpose" IN ('password', 'email')),
  "code_hash" text NOT NULL,
  "payload" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_codes_user_purpose" ON "auth_codes" ("user_id", "purpose");
