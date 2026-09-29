import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('mobile login, tenant access, and revocable logout through real HTTP routes',
  { timeout: 90_000 }, async () => {
    const store = await db.store.create({ data: { name: 'Mobile HTTP integration' } });
    const otherStore = await db.store.create({ data: { name: 'Other tenant' } });
    const email = `mobile-ci-${store.id}@example.com`;
    const password = 'temporary-mobile-test-password';
    const port = await freePort();
    let output = '';
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start',
      '-p', String(port), '-H', '127.0.0.1'], { env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });
    const url = `http://127.0.0.1:${port}`;
    try {
      await db.user.create({ data: { storeId: store.id, email,
        passwordHash: await hash(password, 10), status: 'ACTIVE', role: 'OWNER' } });
      let ready = false;
      for (let attempt = 0; attempt < 70; attempt++) {
        if (child.exitCode !== null) throw new Error(`Next server exited: ${output}`);
        try { const response = await fetch(`${url}/api/mobile/auth/login`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
        }); if (response.status === 401 || response.status === 429) { ready = true; break; } }
        catch { /* Server not listening yet. */ }
        await delay(400);
      }
      assert.ok(ready, `Next server did not start: ${output}`);
      const login = await fetch(`${url}/api/mobile/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (login.status !== 200) throw new Error(`Mobile login failed (${login.status}): ${await login.text()}`);
      const { data } = await login.json();
      const headers = { authorization: `Bearer ${data.token}` };
      const me = await fetch(`${url}/api/mobile/me`, { headers });
      assert.equal(me.status, 200);
      assert.equal((await me.json()).data.store.name, store.name);
      const orders = await fetch(`${url}/api/mobile/orders`, { headers });
      assert.equal(orders.status, 200);
      assert.equal((await orders.json()).count, 0);
      const category = await db.expenseCategory.create({ data: { storeId: store.id, name: 'Return Cost' } });
      const order = await db.order.create({ data: {
        storeId: store.id, orderNumber: 'M-CI-123', currency: 'EGP', occurredAt: new Date(),
        customerRef: 'Test Customer', customerPhone: '01000000000', customerAddress: 'Cairo',
        total: 450, items: { create: { title: 'Oud 30 ml', quantity: 1 } },
      }, include: { items: true } });
      const returned = await db.return.create({ data: {
        storeId: store.id, orderId: order.id, status: 'PROCESSED', returnCost: 95,
        items: { create: { orderItemId: order.items[0].id, quantity: 1, condition: 'GOOD' } },
      } });
      const expense = await db.expense.create({ data: {
        storeId: store.id, categoryId: category.id, returnId: returned.id,
        amount: 95, currency: 'EGP', date: new Date(), description: `Return for order ${order.id}`,
      } });
      const expenseDetails = await fetch(`${url}/api/expenses/${expense.id}`, { headers });
      assert.equal(expenseDetails.status, 200);
      const linked = (await expenseDetails.json()).data;
      assert.equal(linked.return.order.orderNumber, 'M-CI-123');
      assert.equal(linked.return.order.customerRef, 'Test Customer');
      assert.equal(linked.return.items[0].orderItem.title, 'Oud 30 ml');
      const foreignCategory = await db.expenseCategory.create({ data: { storeId: otherStore.id, name: 'Other' } });
      const foreignExpense = await db.expense.create({ data: {
        storeId: otherStore.id, categoryId: foreignCategory.id,
        amount: 10, currency: 'EGP', date: new Date(),
      } });
      assert.equal((await fetch(`${url}/api/expenses/${foreignExpense.id}`, { headers })).status, 404);
      const ownerEmail = `second-${store.id}@example.com`;
      const ownerPassword = 'another-temporary-owner-password';
      const createOwner = async currentPassword => fetch(`${url}/api/mobile/account/users`, {
        method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Second owner', email: ownerEmail,
          password: ownerPassword, currentPassword }),
      });
      assert.equal((await createOwner('incorrect-password')).status, 403);
      assert.equal((await createOwner(password)).status, 201);
      assert.equal((await createOwner(password)).status, 409);
      const users = await fetch(`${url}/api/mobile/account/users`, { headers });
      assert.equal(users.status, 200);
      const listed = (await users.json()).data;
      assert.equal(listed.length, 2);
      assert.ok(listed.every(user => user.role === 'OWNER' && !('passwordHash' in user)));
      const secondLogin = await fetch(`${url}/api/mobile/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
      });
      assert.equal(secondLogin.status, 200);
      assert.equal((await secondLogin.json()).data.user.role, 'OWNER');
      const changePassword = async currentPassword => fetch(`${url}/api/mobile/account/password`, {
        method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: 'changed-mobile-owner-password' }),
      });
      assert.equal((await changePassword('incorrect-password')).status, 403);
      assert.equal((await changePassword(password)).status, 200);
      assert.equal((await fetch(`${url}/api/mobile/me`, { headers })).status, 401);
      const newLogin = await fetch(`${url}/api/mobile/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'changed-mobile-owner-password' }),
      });
      assert.equal(newLogin.status, 200);
      const newHeaders = { authorization: `Bearer ${(await newLogin.json()).data.token}` };
      const logout = await fetch(`${url}/api/mobile/auth/logout`, { method: 'POST', headers: newHeaders });
      assert.equal(logout.status, 200);
      assert.equal((await fetch(`${url}/api/mobile/me`, { headers: newHeaders })).status, 401);
    } finally {
      child.kill('SIGTERM');
      await delay(100);
      await db.store.delete({ where: { id: store.id } });
      await db.store.delete({ where: { id: otherStore.id } });
      await db.$disconnect();
    }
  });
