import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

test('store isolation, unique Shopify IDs and transaction rollback in PostgreSQL', async () => {
  const first = await db.store.create({ data: { name: 'CI A' } });
  const second = await db.store.create({ data: { name: 'CI B' } });
  try {
    const order = await db.order.create({ data: {
      storeId: first.id, shopifyId: 'gid://shopify/Order/ci-1', currency: 'EGP',
      total: 100, refunded: 20, netSales: 80, occurredAt: new Date(),
    } });
    assert.equal((await db.order.findMany({ where: { storeId: second.id } })).length, 0);
    assert.equal(Number(order.netSales), 80);
    await assert.rejects(db.order.create({ data: {
      storeId: first.id, shopifyId: 'gid://shopify/Order/ci-1', currency: 'EGP', occurredAt: new Date(),
    } }), /Unique constraint/);
    await db.order.create({ data: {
      storeId: second.id, shopifyId: 'gid://shopify/Order/ci-1', currency: 'EGP', occurredAt: new Date(),
    } });
    await assert.rejects(db.$transaction(async tx => {
      await tx.expenseCategory.create({ data: { storeId: first.id, name: 'Should roll back' } });
      throw new Error('abort transaction');
    }), /abort transaction/);
    assert.equal(await db.expenseCategory.count({ where: { storeId: first.id } }), 0);
  } finally {
    await db.store.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  }
});

test.after(async () => { await db.$disconnect(); });
