import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileBalances } from '../src/services/reconciliation.math.ts';
const material = { name: 'Bottle', unit: 'pcs' };
test('ledger movements reconcile to saved balance', () => {
  const result = reconcileBalances([{ materialId: 'm1', quantity: '8', material }], [
    { materialId: 'm1', type: 'PURCHASE', quantity: '10' },
    { materialId: 'm1', type: 'CONSUMPTION', quantity: '3' },
    { materialId: 'm1', type: 'RETURN_RESTOCK', quantity: '1' },
  ]);
  assert.deepEqual(result.differences, []);
});
test('flags discrepancy and unknown ledger type without guessing direction', () => {
  const result = reconcileBalances([{ materialId: 'm1', quantity: '5', material }], [
    { materialId: 'm1', type: 'OPENING', quantity: '4' },
    { materialId: 'm1', type: 'NEW_TYPE', quantity: '1' },
  ]);
  assert.equal(result.differences[0].ledger, 4);
  assert.deepEqual(result.unknownTransactionTypes, ['NEW_TYPE']);
});
