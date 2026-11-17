// Neon Bay tuning: every number the game balances on lives in this one file,
// so a balance pass touches one place. Nothing here draws or steps.
export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-bay.save.v1';
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
export const ROAD_WIDTH = 96;
export const ROADS_X = [240, 640, 1040, 1440, 1840, 2240, 2640, 2960];
export const ROADS_Y = [240, 640, 1040, 1440, 1840, 2160];
export const START_CASH = 120;
export const START_AMMO = 24;
export const START_CLOCK_MINUTES = 17 * 60 + 15;
export const MISSION_REWARDS = [150, 300, 500];
export const MAX_WANTED = 5;
export const WANTED_HIDE_SECONDS = 6;
export const WANTED_DROP_SECONDS = 4;
export const PLAYER_WALK_SPEED = 230;
export const PLAYER_RADIUS = 14;
export const CAR_TOP_SPEED = 520;
export const CAR_REVERSE_SPEED = 180;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 620;
export const CRUISER_SPEED = 470;
export const COP_WALK_SPEED = 205;
export const BULLET_SPEED = 780;
export const RAM_DAMAGE = 4;
export const COP_PUNCH_DAMAGE = 5;
export const PICKUP_CASH_MIN = 20;
export const PICKUP_CASH_MAX = 50;
export const ARMOR_PICKUP = 50;
export const HEALTH_PICKUP = 40;
export const AMMO_PICKUP = 12;
export const FARE_MIN = 40;
export const FARE_MAX = 70;
export const BUSTED_FINE = 100;
export const WASTED_FINE_RATE = 0.1;

// Six districts, each a set of rectangles with its own ground tint and name.
// The map is drawn district by district, then roads, then buildings.
export const DISTRICTS = [
  { name: 'Marina Beach', tint: '#e2c184', rects: [{ x: 0, y: 0, w: 320, h: 2400 }] },
  { name: 'Old Town', tint: '#c0b193', rects: [{ x: 320, y: 0, w: 2880, h: 640 }, { x: 320, y: 640, w: 720, h: 800 }] },
  { name: 'Downtown', tint: '#b3ab99', rects: [{ x: 1040, y: 640, w: 1200, h: 800 }] },
  { name: 'Sunset Hills', tint: '#c4a87e', rects: [{ x: 2240, y: 640, w: 720, h: 800 }] },
  { name: 'Palms', tint: '#cbb184', rects: [{ x: 320, y: 1440, w: 1920, h: 960 }] },
  { name: 'The Docks', tint: '#a89a7e', rects: [{ x: 2240, y: 1440, w: 960, h: 960 }] },
];

export const PARK_RECT = { x: 1088, y: 1088, w: 304, h: 304 };
export const PLAZA_RECT = { x: 1888, y: 1088, w: 304, h: 304 };
export const SEA_RECT = { x: 0, y: 0, w: 96, h: 2400 };

// Day-to-sunset palette: the overlay warms as the clock runs past 5 PM.
export const PALETTE = {
  road: '#4a4550',
  roadEdge: '#6b6572',
  lane: '#d8c96a',
  sidewalk: '#9a8f7c',
  sand: '#ecd096',
  sea: '#3f8fb5',
  park: '#5d8a4a',
  plaza: '#c9bfa5',
  buildingRoofs: ['#b5654a', '#7a6a8a', '#5a7a8a', '#a08a5a', '#8a5a6a', '#6a8a6a'],
  carColors: ['#c23b2e', '#2e6fc2', '#d8d8d8', '#2a2a2e', '#c2a13b', '#3b8a5a', '#7a4ab5', '#c26a2e'],
};

// True when the point sits on a road (the drivable, walkable asphalt).
export function onRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// True when a circle at (x, y) with radius r overlaps any building rect.
export function hitsBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle `from` toward angle `to`.
export function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// 12-hour clock string, e.g. 5:15 PM. Never prints "17:21 PM".
export function clockString(minutes) {
  const total = ((Math.floor(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

// 0 at noon, rising toward 1 as the sun sets (6 PM to 8 PM).
export function sunsetAmount(minutes) {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  if (total < 17 * 60) return 0;
  if (total > 20 * 60) return 1;
  return (total - 17 * 60) / (3 * 60);
}
