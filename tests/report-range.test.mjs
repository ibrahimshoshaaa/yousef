import test from 'node:test';
import assert from 'node:assert/strict';
import { getReportRange } from '../src/services/report-range.ts';

test('Cairo local day boundaries respect spring clock change', () => {
  const day = getReportRange('Africa/Cairo', 'custom', '2026-04-23', '2026-04-23');
  assert.equal(day.start.toISOString(), '2026-04-22T22:00:00.000Z');
  assert.equal(day.endExclusive.toISOString(), '2026-04-23T21:00:00.000Z');
});
test('custom range rejects reversed and malformed dates', () => {
  assert.throws(() => getReportRange('Africa/Cairo', 'custom', '2026-02-30', '2026-03-02'), /Invalid date range/);
  assert.throws(() => getReportRange('Africa/Cairo', 'custom', '2026-05-02', '2026-05-01'), /Invalid date range/);
});
test('rolling seven-day period includes today', () => {
  const range = getReportRange('Africa/Cairo', '7d', undefined, undefined, new Date('2026-09-25T14:00:00Z'));
  assert.equal(range.from, '2026-09-19'); assert.equal(range.to, '2026-09-25');
});
