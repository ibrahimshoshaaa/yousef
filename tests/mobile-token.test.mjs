import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMobileToken, hashMobileToken, parseMobileAuthorization } from '../src/lib/mobile-token.ts';

test('mobile token can be parsed and is never stored in plaintext', () => {
  const token = createMobileToken();
  assert.equal(parseMobileAuthorization(`Bearer ${token}`), token);
  assert.match(hashMobileToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashMobileToken(token), token);
  assert.notEqual(createMobileToken(), token);
});

test('rejects non-mobile, malformed and extra credentials', () => {
  for (const value of [null, 'Bearer abc', 'Basic abc', 'Bearer perf_abc',
    `Bearer ${createMobileToken()} extra`]) {
    assert.equal(parseMobileAuthorization(value), null);
  }
});
