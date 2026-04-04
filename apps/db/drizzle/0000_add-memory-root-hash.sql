CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"wallet_address" text NOT NULL,
	"display_name" text NOT NULL,
	"genie_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"counterparty_wallet" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"description" text,
	"settled" boolean DEFAULT false NOT NULL,
	"i_owe" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"recipient_wallet" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"tx_hash" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"expires_at" timestamp,
	"category" text,
	"source" text DEFAULT 'genie_send' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"world_id" text,
	"display_name" text NOT NULL,
	"auto_approve_usd" numeric(10, 2) DEFAULT '25' NOT NULL,
	"memory_root_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_genie_user_id_users_id_fk" FOREIGN KEY ("genie_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;