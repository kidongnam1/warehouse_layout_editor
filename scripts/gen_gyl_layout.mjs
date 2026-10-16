// gen_gyl_layout.mjs — build the GY Logis Gwangyang G5/G6 layout.
//
// Location format: G{building}-{rack:02}-{column:02}-{level:02}
//   site terms: 동 - 칸(랙 번호) - 열 - 층
//   e.g. G5-04-01-07 = 5동, 4칸(4번 랙), 1열, 7층
//
// Racks (칸) 01–03 and 14–16 have 6 levels; racks 04–13 have 7 levels.
// Every rack has 31 columns (열).
//
// PHYSICAL DIMENSIONS ARE PLACEHOLDERS until a site survey replaces them:
// position width, rack depth, level height, aisle width and building gap.
//
// Usage: node scripts/gen_gyl_layout.mjs [layout.json] [locations.csv]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SCHEMA_VERSION, validateLayout } from '../app/js/schema.js';
import { toDbConnect } from '../app/js/dbconnect.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const BUILDINGS = ['5', '6'];
export const RACK_COUNT = 16;
export const POSITIONS = 31; // columns (열) per rack

// Placeholder geometry (metres) — replace with surveyed values.
const POS_W = 1.4; // width of one column (열) along the rack
const RACK_D = 1.2; // rack depth
const LEVEL_H = 1.6; // height of one level
const AISLE = 3.5; // aisle between racks
const BUILDING_GAP = 10; // gap between building 5 and building 6
const MARGIN = 2; // clearance inside the building wall

export function levelsForRack(rackNo) {
  return rackNo >= 4 && rackNo <= 13 ? 7 : 6;
}

export function buildState() {
  const rackPitch = RACK_D + AISLE;
  const zoneW = MARGIN * 2 + RACK_COUNT * RACK_D + (RACK_COUNT - 1) * AISLE;
  const zoneD = MARGIN * 2 + POSITIONS * POS_W;

  const zones = [];
  const racks = [];
  BUILDINGS.forEach((bld, bi) => {
    const zoneX = bi * (zoneW + BUILDING_GAP);
    zones.push({
      id: `G${bld}`,
      x: zoneX,
      y: 0,
      w: +zoneW.toFixed(1),
      d: +zoneD.toFixed(1),
      elev: 0,
      clearH: 7 * LEVEL_H + 1,
      color: bi === 0 ? '#4e6d8c' : '#5e7a5a',
    });
    for (let n = 1; n <= RACK_COUNT; n++) {
      const levels = levelsForRack(n);
      const rackNo = String(n).padStart(2, '0');
      racks.push({
        id: `G${bld}-R${rackNo}`,
        type: 'GYL',
        dir: 'N',
        bays: POSITIONS,
        levels,
        levelHeights: Array.from({ length: levels }, () => LEVEL_H),
        rowToken: `G${bld}-${rackNo}`,
        bayStart: 1,
        bayReverse: false,
        x: +(zoneX + MARGIN + (n - 1) * rackPitch).toFixed(1),
        y: MARGIN,
        access_face: null,
        back_to_back_spine: null,
        bayLevelOverrides: {},
      });
    }
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name: 'GY LOGIS GWANGYANG G5/G6',
      bin_label_format: {
        field_name: 'whse_location',
        pattern: 'G{building}-{rack:02d}-{column:02d}-{level:02d}',
        note: 'GY Logis 4-part key: building (동), rack (칸, 01-16), column (열, 01-31), level (층, 01-07). Physical dimensions are placeholders pending site survey.',
      },
    },
    settings: { snap: 0.5, grid: 1 },
    naming: { separator: '-', bayPad: 2, levelPad: 2 },
    binOverrides: {},
    binTypes: { GYL: { w: POS_W, d: RACK_D, h: LEVEL_H, color: '#6f93c4' } },
    zones,
    nodes: [],
    edges: [],
    racks,
    bg: null,
  };
}

export function toCsv(bins) {
  const lines = ['whse_location,building,rack,column,level'];
  for (const b of bins) {
    const [g, rack, col, lvl] = b.whse_location.split('-');
    lines.push(`${b.whse_location},${g.slice(1)},${rack},${col},${lvl}`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const state = buildState();
  const check = validateLayout(state);
  if (!check.ok) {
    console.error('Layout validation failed:\n' + check.errors.join('\n'));
    process.exit(1);
  }
  const file = toDbConnect(state);
  const layoutPath = process.argv[2] ?? join(root, 'app', 'data', 'gyl_g5_g6_layout.json');
  const csvPath = process.argv[3] ?? join(root, 'app', 'data', 'gyl_locations.csv');
  writeFileSync(layoutPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
  writeFileSync(csvPath, toCsv(file.bins), 'utf8');
  console.log(`Layout written: ${layoutPath}`);
  console.log(`Locations written: ${csvPath} (${file.bins.length} rows)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
