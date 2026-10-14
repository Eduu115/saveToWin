-- Versión de sesión: al cambiar la contraseña sube y las sesiones anteriores dejan de valer.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;
