-- Altas pendientes de confirmar el email: la cuenta se crea al validar el código.
CREATE TABLE IF NOT EXISTS "pending_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_registrations_email_unique" UNIQUE("email")
);
