// Emberwarden — config.js
// Every tuning number, colour and definition the game uses lives here, so
// balancing the game means editing this one file and nothing else.

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

// The buildable field: 16 columns by 9 rows of 64 px cells.
export const CELL = 64;
export const GRID_COLS = 16;
export const GRID_ROWS = 9;
export const FIELD_X = 0;
export const FIELD_Y = 72;
export const FIELD_WIDTH = GRID_COLS * CELL; // 1024
export const FIELD_HEIGHT = GRID_ROWS * CELL; // 576

// Right-hand panel (shop + selected tower) and the top HUD bar.
export const PANEL_X = 1032;
export const PANEL_WIDTH = 248;
export const HUD_HEIGHT = 64;

// The ember road: cells the cinders walk, in order, from the west gate to
// the Last Lantern on the east edge.
export const PATH_CELLS = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
  [5, 2], [5, 3], [5, 4],
  [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
  [10, 5], [10, 6], [10, 7],
  [11, 7], [12, 7], [13, 7], [14, 7], [15, 7],
];
export const LANTERN_CELL = [15, 7];
export const SPAWN_CELL = [0, 1];

export const START_GOLD = 150;
export const LANTERN_HP = 10;
export const TOTAL_WAVES = 10;
export const MAX_TOWER_LEVEL = 3;

// A coherent ember palette: deep night blues, hot orange golds, cold frost.
export const PALETTE = {
  skyTop: '#0b1026',
  skyBottom: '#1a1033',
  ground: '#141a2e',
  groundAlt: '#171e36',
  path: '#3a2a1a',
  pathEdge: '#6b4a26',
  gridLine: 'rgba(140, 170, 255, 0.07)',
  buildable: 'rgba(120, 200, 255, 0.10)',
  buildableHover: 'rgba(120, 200, 255, 0.22)',
  blocked: 'rgba(255, 80, 60, 0.10)',
  hudBg: '#0d1226',
  hudLine: '#2a3560',
  panelBg: '#10162e',
  panelLine: '#2a3560',
  text: '#f2ead8',
  textDim: '#9aa5c8',
  gold: '#ffc857',
  goldDark: '#b98a2e',
  hp: '#ff6b5e',
  hpGood: '#7dff9a',
  spark: '#ffd23f',
  frost: '#7de3ff',
  ember: '#ff7a3c',
  lantern: '#ffe9a8',
  lanternGlow: 'rgba(255, 200, 90, 0.35)',
  cinder: '#ff8c42',
  swift: '#ffd23f',
  brute: '#c65bff',
  emberling: '#ff5e78',
  boss: '#ff2e63',
  button: '#2c3a6e',
  buttonHover: '#3b4c8f',
  buttonText: '#f2ead8',
  danger: '#ff4757',
};

// One definition per tower kind. range and damage are per level-1 tower;
// upgradeTower() in world.js scales them per level.
export const TOWER_DEFS = {
  spark: {
    key: 'spark',
    name: 'Spark Spire',
    short: 'SPARK',
    cost: 50,
    range: 2.3 * CELL,
    damage: 8,
    rate: 2.6, // shots per second
    projectileSpeed: 520,
    color: PALETTE.spark,
    dark: '#8a6d1d',
    blurb: 'Fast, cheap bolts.',
    hotkey: '1',
  },
  frost: {
    key: 'frost',
    name: 'Frost Obelisk',
    short: 'FROST',
    cost: 75,
    range: 2.1 * CELL,
    damage: 4,
    rate: 1.1,
    projectileSpeed: 420,
    slowFactor: 0.55, // enemy speed multiplier while chilled
    slowSeconds: 1.6,
    color: PALETTE.frost,
    dark: '#1d5a74',
    blurb: 'Chills the horde.',
    hotkey: '2',
  },
  ember: {
    key: 'ember',
    name: 'Ember Cannon',
    short: 'EMBER',
    cost: 120,
    range: 2.9 * CELL,
    damage: 34,
    rate: 0.6,
    projectileSpeed: 380,
    splash: 0.95 * CELL,
    color: PALETTE.ember,
    dark: '#7a2f10',
    blurb: 'Heavy splash shells.',
    hotkey: '3',
  },
};

export const TOWER_ORDER = ['spark', 'frost', 'ember'];

// One definition per enemy kind. hp scales per wave in world.js.
export const ENEMY_DEFS = {
  cinder: {
    key: 'cinder',
    name: 'Cinder',
    hp: 30,
    speed: 1.05, // cells per second
    reward: 6,
    score: 10,
    radius: 15,
    color: PALETTE.cinder,
  },
  swift: {
    key: 'swift',
    name: 'Swift',
    hp: 18,
    speed: 1.95,
    reward: 8,
    score: 15,
    radius: 12,
    color: PALETTE.swift,
  },
  emberling: {
    key: 'emberling',
    name: 'Emberling',
    hp: 11,
    speed: 1.45,
    reward: 3,
    score: 5,
    radius: 9,
    color: PALETTE.emberling,
  },
  brute: {
    key: 'brute',
    name: 'Brute',
    hp: 130,
    speed: 0.55,
    reward: 15,
    score: 30,
    radius: 21,
    color: PALETTE.brute,
  },
  boss: {
    key: 'boss',
    name: 'Cinder King',
    hp: 950,
    speed: 0.42,
    reward: 150,
    score: 500,
    radius: 30,
    color: PALETTE.boss,
  },
};

// The wave table: each wave lists groups of [enemy key, count, gap seconds].
// Gaps are between spawns inside a group; groups run one after another.
export const WAVE_TABLE = [
  { groups: [['cinder', 6, 0.9]] },
  { groups: [['cinder', 9, 0.8], ['emberling', 6, 0.35]] },
  { groups: [['cinder', 8, 0.7], ['swift', 5, 0.6]] },
  { groups: [['emberling', 14, 0.3], ['cinder', 8, 0.6], ['brute', 2, 1.2]] },
  { groups: [['swift', 10, 0.5], ['cinder', 10, 0.55], ['brute', 2, 1.0]] },
  { groups: [['emberling', 20, 0.25], ['swift', 8, 0.45], ['brute', 3, 1.0]] },
  { groups: [['brute', 5, 0.9], ['cinder', 12, 0.5], ['swift', 8, 0.4]] },
  { groups: [['swift', 14, 0.4], ['emberling', 22, 0.22], ['brute', 4, 0.8]] },
  { groups: [['brute', 7, 0.7], ['swift', 12, 0.38], ['cinder', 14, 0.45]] },
  { groups: [['boss', 1, 0.0], ['emberling', 16, 0.3], ['brute', 4, 0.9], ['swift', 10, 0.4]] },
];

// Enemy hit points grow with the wave so late waves stay dangerous.
export function waveHpScale(wave) {
  return 1 + (wave - 1) * 0.22;
}

// Gold bonus for clearing a wave.
export function waveClearBonus(wave) {
  return 25 + wave * 5;
}

// Upgrade cost for taking a tower from `level` to `level + 1`.
export function upgradeCost(towerDef, level) {
  return Math.round(towerDef.cost * 0.8 * level);
}

// Refund for selling a tower: 70% of everything invested in it.
export function sellRefund(tower) {
  return Math.floor(tower.invested * 0.7);
}
