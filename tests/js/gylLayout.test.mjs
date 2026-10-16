import test from 'node:test';
import assert from 'node:assert/strict';

import { buildState, levelsForRack, toCsv } from '../../scripts/gen_gyl_layout.mjs';
import { expandBins } from '../../app/js/geometry.js';
import { validateLayout } from '../../app/js/schema.js';

const state = buildState();
const bins = expandBins(state);
const labels = new Set(bins.map((b) => b.whse_location));

test('GYL layout passes schema validation', () => {
  const r = validateLayout(state);
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('user examples exist with exact 4-part format', () => {
  assert.ok(labels.has('G5-04-01-07'));
  assert.ok(labels.has('G5-16-31-06'));
  assert.ok(labels.has('G6-04-01-07'));
});

test('6-level racks have no level 07', () => {
  for (const rack of ['01', '02', '03', '14', '15', '16']) {
    assert.ok(labels.has(`G5-${rack}-31-06`));
    assert.ok(!labels.has(`G5-${rack}-01-07`));
  }
  assert.equal(levelsForRack(3), 6);
  assert.equal(levelsForRack(4), 7);
  assert.equal(levelsForRack(13), 7);
  assert.equal(levelsForRack(14), 6);
});

test('location count: per building 3286, total 6572, no duplicates', () => {
  const perBuilding = (3 * 6 + 10 * 7 + 3 * 6) * 31;
  assert.equal(perBuilding, 3286);
  assert.equal(bins.length, perBuilding * 2);
  assert.equal(labels.size, bins.length);
});

test('every bin falls inside its own building zone', () => {
  for (const b of bins) assert.equal(b.zone, b.whse_location.slice(0, 2));
});

test('levelPad absent keeps legacy unpadded levels', () => {
  const legacy = { ...state, naming: { separator: '-', bayPad: 2 } };
  assert.ok(expandBins(legacy).some((b) => b.whse_location === 'G5-04-01-7'));
});

test('CSV splits label into building/rack(칸)/column(열)/level', () => {
  const csv = toCsv([{ whse_location: 'G5-04-01-07' }]);
  assert.equal(csv.split('\n')[1], 'G5-04-01-07,5,04,01,07');
});
