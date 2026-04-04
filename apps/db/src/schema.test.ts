import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { users, contacts, transactions, debts } from './schema';

let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema });
  const result = await pushSchema(schema, db as any);
  await result.apply();
});

describe('users table', () => {
  it('has correct columns: id, wallet_address (unique, not null), world_id (nullable), display_name (not null), auto_approve_usd (not null, default 25), created_at (not null)', async () => {
    const cols = Object.keys(users);
    expect(cols).toContain('id');
    expect(cols).toContain('walletAddress');
    expect(cols).toContain('worldId');
    expect(cols).toContain('displayName');
    expect(cols).toContain('autoApproveUsd');
    expect(cols).toContain('createdAt');

    // wallet_address is unique and not null
    expect((users.walletAddress as any).isUnique).toBe(true);
    expect((users.walletAddress as any).notNull).toBe(true);

    // world_id is nullable
    expect((users.worldId as any).notNull).toBeFalsy();

    // display_name is not null
    expect((users.displayName as any).notNull).toBe(true);

    // auto_approve_usd is not null
    expect((users.autoApproveUsd as any).notNull).toBe(true);

    // created_at is not null
    expect((users.createdAt as any).notNull).toBe(true);
  });
});

describe('contacts table', () => {
  it('has correct columns: id, owner_user_id (FK->users, not null), wallet_address (not null), display_name (not null), genie_user_id (FK->users, nullable), created_at (not null)', async () => {
    const cols = Object.keys(contacts);
    expect(cols).toContain('id');
    expect(cols).toContain('ownerUserId');
    expect(cols).toContain('walletAddress');
    expect(cols).toContain('displayName');
    expect(cols).toContain('genieUserId');
    expect(cols).toContain('createdAt');

    // owner_user_id is not null
    expect((contacts.ownerUserId as any).notNull).toBe(true);

    // genie_user_id is nullable (no notNull)
    expect((contacts.genieUserId as any).notNull).toBeFalsy();
  });
});

describe('transactions table', () => {
  it('has correct columns: id, sender_user_id (FK->users, not null), recipient_wallet (not null), amount_usd (not null), tx_hash (nullable), category (nullable), source (not null), created_at (not null)', async () => {
    const cols = Object.keys(transactions);
    expect(cols).toContain('id');
    expect(cols).toContain('senderUserId');
    expect(cols).toContain('recipientWallet');
    expect(cols).toContain('amountUsd');
    expect(cols).toContain('txHash');
    expect(cols).toContain('category');
    expect(cols).toContain('source');
    expect(cols).toContain('createdAt');

    // sender_user_id is not null
    expect((transactions.senderUserId as any).notNull).toBe(true);

    // tx_hash is nullable
    expect((transactions.txHash as any).notNull).toBeFalsy();

    // category is nullable
    expect((transactions.category as any).notNull).toBeFalsy();

    // source is not null with default
    expect((transactions.source as any).notNull).toBe(true);
  });
});

describe('debts table', () => {
  it('has correct columns: id, owner_user_id (FK->users, not null), counterparty_wallet (not null), amount_usd (not null), description (nullable), settled (not null, default false), iOwe (not null, default false), created_at (not null)', async () => {
    const cols = Object.keys(debts);
    expect(cols).toContain('id');
    expect(cols).toContain('ownerUserId');
    expect(cols).toContain('counterpartyWallet');
    expect(cols).toContain('amountUsd');
    expect(cols).toContain('description');
    expect(cols).toContain('settled');
    expect(cols).toContain('iOwe');
    expect(cols).toContain('createdAt');

    // owner_user_id is not null
    expect((debts.ownerUserId as any).notNull).toBe(true);

    // description is nullable
    expect((debts.description as any).notNull).toBeFalsy();

    // settled is not null
    expect((debts.settled as any).notNull).toBe(true);

    // iOwe is not null with default false
    expect((debts.iOwe as any).notNull).toBe(true);
  });
});

describe('insert/select round-trips', () => {
  it('inserts a user and contact, selects both back', async () => {
    const [user] = await db.insert(users).values({
      walletAddress: '0xABC123',
      displayName: 'Test User',
    }).returning();

    expect(user.id).toBeTruthy();
    expect(user.walletAddress).toBe('0xABC123');
    expect(user.displayName).toBe('Test User');
    expect(user.worldId).toBeNull();
    expect(user.autoApproveUsd).toBe('25.00');

    const [contact] = await db.insert(contacts).values({
      ownerUserId: user.id,
      walletAddress: '0xDEF456',
      displayName: 'Contact User',
    }).returning();

    expect(contact.id).toBeTruthy();
    expect(contact.ownerUserId).toBe(user.id);
    expect(contact.walletAddress).toBe('0xDEF456');
    expect(contact.genieUserId).toBeNull();

    const [fetchedUser] = await db.select().from(users).where(eq(users.id, user.id));
    expect(fetchedUser.walletAddress).toBe('0xABC123');

    const [fetchedContact] = await db.select().from(contacts).where(eq(contacts.id, contact.id));
    expect(fetchedContact.displayName).toBe('Contact User');
  });

  it('inserts a user and transaction, selects transaction back with correct amount', async () => {
    const [user] = await db.insert(users).values({
      walletAddress: '0xSENDER001',
      displayName: 'Sender',
    }).returning();

    const [tx] = await db.insert(transactions).values({
      senderUserId: user.id,
      recipientWallet: '0xRECIPIENT001',
      amountUsd: '42.50',
    }).returning();

    expect(tx.id).toBeTruthy();
    expect(tx.senderUserId).toBe(user.id);
    expect(tx.recipientWallet).toBe('0xRECIPIENT001');
    expect(tx.amountUsd).toBe('42.50');
    expect(tx.txHash).toBeNull();

    const [fetchedTx] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
    expect(fetchedTx.amountUsd).toBe('42.50');
  });

  it('inserts a transaction with category "food" and source "genie_send" -- round-trips correctly', async () => {
    const [user] = await db.insert(users).values({
      walletAddress: '0xSENDER002',
      displayName: 'Sender2',
    }).returning();

    const [tx] = await db.insert(transactions).values({
      senderUserId: user.id,
      recipientWallet: '0xRECIPIENT002',
      amountUsd: '10.00',
      category: 'food',
      source: 'genie_send',
    }).returning();

    expect(tx.category).toBe('food');
    expect(tx.source).toBe('genie_send');
  });

  it('inserts a transaction with category null -- accepted (nullable)', async () => {
    const [user] = await db.insert(users).values({
      walletAddress: '0xSENDER003',
      displayName: 'Sender3',
    }).returning();

    const [tx] = await db.insert(transactions).values({
      senderUserId: user.id,
      recipientWallet: '0xRECIPIENT003',
      amountUsd: '5.00',
      category: null,
    }).returning();

    expect(tx.category).toBeNull();
    expect(tx.source).toBe('genie_send'); // default value
  });

  it('inserts a debt with iOwe true -- round-trips correctly', async () => {
    const [user] = await db.insert(users).values({
      walletAddress: '0xDEBTOR001',
      displayName: 'Debtor1',
    }).returning();

    const [debt] = await db.insert(debts).values({
      ownerUserId: user.id,
      counterpartyWallet: '0xCREDITOR001',
      amountUsd: '30.00',
      description: 'dinner',
      iOwe: true,
    }).returning();

    expect(debt.iOwe).toBe(true);
    expect(debt.settled).toBe(false);
  });

  it('inserts a debt with default iOwe false', async () => {
    const [user] = await db.insert(users).values({
      walletAddress: '0xDEBTOR002',
      displayName: 'Debtor2',
    }).returning();

    const [debt] = await db.insert(debts).values({
      ownerUserId: user.id,
      counterpartyWallet: '0xCREDITOR002',
      amountUsd: '20.00',
    }).returning();

    expect(debt.iOwe).toBe(false); // default
  });
});
