import { db } from './client';
import { users, contacts, transactions, debts } from './schema';

async function clearDatabase() {
  console.log('--- Clearing Supabase Database ---');
  
  try {
    // Delete in reverse order of foreign key dependencies
    console.log('Deleting transactions...');
    await db.delete(transactions);
    
    console.log('Deleting debts...');
    await db.delete(debts);
    
    console.log('Deleting contacts...');
    await db.delete(contacts);
    
    console.log('Deleting users...');
    await db.delete(users);
    
    console.log('✅ Successfully cleared all database entries.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();
