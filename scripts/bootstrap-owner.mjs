// Run only from an administrator's trusted shell, after applying the Prisma schema.
// Reads secrets from the environment; never logs or writes the password.
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const db = new PrismaClient();
function isValidEmail(email) {
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  return !/\s/.test(email) && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}
async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  let storeId = process.env.OWNER_STORE_ID;
  if (!email || !isValidEmail(email) || !password || password.length < 12 || password.length > 1024) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD (12+ characters)');
  if (!storeId) {
    const stores = await db.store.findMany({ select: { id: true } });
    if (stores.length === 1) storeId = stores[0].id;
    else if (stores.length === 0 && process.env.OWNER_STORE_NAME) {
      const store = await db.store.create({ data: { name: process.env.OWNER_STORE_NAME } });
      storeId = store.id;
    } else throw new Error('Set OWNER_STORE_ID when more than one store exists, or OWNER_STORE_NAME for a new database');
  }
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error('Store not found');
  if (await db.user.count({ where: { storeId, role: 'OWNER' } })) throw new Error('Store already has an owner');
  if (await db.user.findUnique({ where: { email } })) throw new Error('Email already exists');
  const passwordHash = await hash(password, 12);
  await db.user.create({ data: { storeId, email, passwordHash, role: 'OWNER', status: 'ACTIVE' } });
  process.stdout.write('Owner created.\n');
}
main().catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; }).finally(() => db.$disconnect());
