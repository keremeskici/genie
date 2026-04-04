import { pgTable, uuid, text, numeric, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull().unique(),
  worldId: text('world_id'),
  displayName: text('display_name').notNull(),
  autoApproveUsd: numeric('auto_approve_usd', { precision: 10, scale: 2 }).notNull().default('25'),
  memoryRootHash: text('memory_root_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  walletAddress: text('wallet_address').notNull(),
  displayName: text('display_name').notNull(),
  genieUserId: uuid('genie_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderUserId: uuid('sender_user_id').notNull().references(() => users.id),
  recipientWallet: text('recipient_wallet').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('confirmed'),
  expiresAt: timestamp('expires_at'),
  category: text('category'),                              // SPND-01, D-05: nullable
  source: text('source').notNull().default('genie_send'),  // D-06
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const debts = pgTable('debts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  counterpartyWallet: text('counterparty_wallet').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  settled: boolean('settled').notNull().default(false),
  iOwe: boolean('i_owe').notNull().default(false),         // D-08: true = I owe them, false = they owe me
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
