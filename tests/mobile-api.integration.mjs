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
      const logout = await fetch(`${url}/api/mobile/auth/logout`, { method: 'POST', headers });
      assert.equal(logout.status, 200);
      assert.equal((await fetch(`${url}/api/mobile/me`, { headers })).status, 401);
    } finally {
      child.kill('SIGTERM');
      await delay(100);
      await db.store.delete({ where: { id: store.id } });
      await db.$disconnect();
    }
  });
