// Neon Bay's world: the city itself (districts, roads, buildings, park, plaza,
// beach, docks), the population (traffic, pedestrians, pickups), and the one
// master step that advances everything in fixed steps. Drawing lives in
// render.js; this file only owns state and rules.
import {
  STEP, SAVE_KEY, WORLD_WIDTH, WORLD_HEIGHT, ROADS_X, ROADS_Y, ROAD_WIDTH,
  START_CASH, START_AMMO, START_CLOCK_MINUTES, MAX_WANTED, WANTED_HIDE_SECONDS,
  WANTED_DROP_SECONDS, PALETTE, PARK_RECT, PLAZA_RECT, PICKUP_CASH_MIN,
  PICKUP_CASH_MAX, ARMOR_PICKUP, HEALTH_PICKUP, AMMO_PICKUP, BUSTED_FINE,
  WASTED_FINE_RATE, hitsBuilding, clamp, dist,
} from './config.js';
import { createRandom } from './random.js';
import { ACTION_ENTER } from './input.js';
import { stepPlayerOnFoot, enterNearestCar, exitPlayerCar } from './player.js';
import { spawnTrafficCars, stepTraffic, stepPlayerCar, makeCar } from './vehicles.js';
import { stepPolice } from './police.js';
import { stepMissions } from './missions.js';
import { stepCombat } from './combat.js';

export function createGame(seed) {
  const rng = createRandom(seed);
  const buildings = buildCity(rng);
  const trees = plantTrees(rng);
  const pickups = scatterPickups(rng);
  const state = {
    seed,
    rng,
    clock: START_CLOCK_MINUTES,
    elapsed: 0,
    cash: START_CASH,
    health: 100,
    armor: 0,
    ammo: START_AMMO,
    wanted: 0,
    hiddenTime: 0,
    dropTimer: 0,
    player: {
      x: 1400, y: 1150, angle: -Math.PI / 2,
      onFoot: true, car: null, invuln: 0,
      punchT: 0, punchCd: 0, shootCd: 0, moving: false,
    },
    cars: [],
    peds: [],
    cruisers: [],
    cops: [],
    bullets: [],
    pickups,
    parts: [],
    buildings,
    trees,
    missionIndex: 0,
    missionStage: 0,
    missionsDone: [],
    bagsCollected: 0,
    fare: null,
    stats: { carsStolen: 0, shotsFired: 0, pedsDown: 0, copsDown: 0, faresDone: 0, earned: 0 },
    over: null,
    overTimer: 0,
    msg: '',
    msgT: 0,
  };
  // The mission taxi waits on the Downtown road, yellow and hard to miss.
  // Parked: it never joins the traffic flow until the player takes it.
  const taxi = makeCar(rng, 1440, 1000, -Math.PI / 2, 'taxi', '#e8b81c');
  taxi.missionTaxi = true;
  taxi.parked = true;
  state.cars.push(taxi);
  spawnTrafficCars(state, 10);
  spawnPedestrians(state, 24);
  return state;
}

// One building block sits between two neighbouring roads; the park, the
// plaza and the beach strip stay open. Each block gets one to three roofs.
function buildCity(rng) {
  const buildings = [];
  const half = ROAD_WIDTH / 2;
  for (let xi = 0; xi < ROADS_X.length - 1; xi += 1) {
    for (let yi = 0; yi < ROADS_Y.length - 1; yi += 1) {
      const bx = ROADS_X[xi] + half + 8;
      const by = ROADS_Y[yi] + half + 8;
      const bw = ROADS_X[xi + 1] - ROADS_X[xi] - ROAD_WIDTH - 16;
      const bh = ROADS_Y[yi + 1] - ROADS_Y[yi] - ROAD_WIDTH - 16;
      if (bx < 320) continue;
      if (overlapsRect(bx, by, bw, bh, PARK_RECT) || overlapsRect(bx, by, bw, bh, PLAZA_RECT)) continue;
      const count = rng.int(1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = rng.range(70, Math.min(150, bw - 20));
        const h = rng.range(70, Math.min(150, bh - 20));
        const x = bx + rng.range(6, Math.max(7, bw - w - 6));
        const y = by + rng.range(6, Math.max(7, bh - h - 6));
        buildings.push({
          x, y, w, h,
          color: rng.pick(PALETTE.buildingRoofs),
          tall: rng.chance(0.3),
        });
      }
    }
  }
  return buildings;
}

function overlapsRect(x, y, w, h, r) {
  return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
}

function plantTrees(rng) {
  const trees = [];
  for (let i = 0; i < 16; i += 1) {
    trees.push({ x: PARK_RECT.x + rng.range(14, PARK_RECT.w - 14), y: PARK_RECT.y + rng.range(14, PARK_RECT.h - 14), r: rng.range(9, 15) });
  }
  for (let i = 0; i < 10; i += 1) {
    trees.push({ x: rng.range(130, 300), y: rng.range(60, WORLD_HEIGHT - 60), r: rng.range(10, 16) });
  }
  return trees;
}

function scatterPickups(rng) {
  const kinds = [
    'cash', 'cash', 'cash', 'cash', 'cash', 'cash',
    'armor', 'armor', 'armor', 'health', 'health', 'health',
    'ammo', 'ammo', 'ammo',
  ];
  const pickups = [];
  for (const kind of kinds) {
    const rx = rng.pick(ROADS_X);
    const ry = rng.pick(ROADS_Y);
    const x = clamp(rx + rng.range(-140, 140), 200, WORLD_WIDTH - 200);
    const y = clamp(ry + rng.range(-140, 140), 200, WORLD_HEIGHT - 200);
    let value = 0;
    if (kind === 'cash') value = rng.int(PICKUP_CASH_MIN, PICKUP_CASH_MAX);
    if (kind === 'armor') value = ARMOR_PICKUP;
    if (kind === 'health') value = HEALTH_PICKUP;
    if (kind === 'ammo') value = AMMO_PICKUP;
    pickups.push({ kind, x, y, value, taken: false, bob: rng.range(0, Math.PI * 2) });
  }
  return pickups;
}

function spawnPedestrians(state, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    const rx = rng.pick(ROADS_X);
    const ry = rng.pick(ROADS_Y);
    const onVertical = rng.chance(0.5);
    const x = onVertical ? rx + rng.pick([-70, 70]) : clamp(rx + rng.range(-160, 160), 140, WORLD_WIDTH - 140);
    const y = onVertical ? clamp(ry + rng.range(-160, 160), 140, WORLD_HEIGHT - 140) : ry + rng.pick([-70, 70]);
    state.peds.push({
      x, y, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(45, 85), color: rng.pick(PALETTE.carColors),
      down: 0, flee: 0, turnT: rng.range(2, 6),
    });
  }
}

export function addWanted(state, amount, reason) {
  state.wanted = Math.min(MAX_WANTED, state.wanted + amount);
  state.hiddenTime = 0;
  state.dropTimer = 0;
  if (reason) showMessage(state, reason);
}

export function showMessage(state, text) {
  state.msg = text;
  state.msgT = 3;
}

export function hurtPlayer(state, damage, audio) {
  const p = state.player;
  if (p.invuln > 0 || state.over) return;
  const absorbed = Math.min(state.armor, damage * 0.6);
  state.armor -= absorbed;
  state.health -= damage - absorbed;
  p.invuln = 1;
  burst(state, p.x, p.y, '#e84a3b', 8);
  if (state.health <= 0) {
    state.health = 0;
    wastePlayer(state, audio);
  }
}

export function wastePlayer(state, audio) {
  if (state.over) return;
  const lost = Math.round(state.cash * WASTED_FINE_RATE);
  state.cash -= lost;
  state.wanted = 0;
  state.over = 'wasted';
  state.overTimer = 0;
  showMessage(state, `Wasted! Lost $${lost}.`);
  if (audio) audio.wasted();
}

export function bustPlayer(state, audio) {
  if (state.over) return;
  const lost = Math.min(BUSTED_FINE, state.cash);
  state.cash -= lost;
  state.wanted = 0;
  state.cops = [];
  state.cruisers = [];
  state.over = 'busted';
  state.overTimer = 0;
  showMessage(state, `Busted! Fined $${lost}.`);
  if (audio) audio.busted();
}

export function burst(state, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const speed = state.rng.range(40, 180);
    state.parts.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.6, color });
  }
  if (state.parts.length > 220) state.parts.splice(0, state.parts.length - 220);
}

// One fixed step: input actions, movement, traffic, police, missions, combat,
// pickups, wanted decay, particles, sound. Returns nothing; the caller reads
// state.over and the HUD values straight off the state.
export function stepGame(state, input, actions, audio, dt) {
  state.elapsed += dt;
  state.clock += dt * 0.5;
  if (state.msgT > 0) state.msgT -= dt;
  const p = state.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.punchT > 0) p.punchT -= dt;

  // The game-over screens keep the city alive behind them but freeze the player.
  if (state.over) {
    state.overTimer += dt;
    stepTraffic(state, dt);
    stepPedestrians(state, dt);
    stepParticles(state, dt);
    return;
  }

  if (actions & ACTION_ENTER) {
    if (p.onFoot) enterNearestCar(state, audio);
    else exitPlayerCar(state);
  }
  if (p.onFoot) stepPlayerOnFoot(state, input, dt);
  else stepPlayerCar(state, input, dt);
  stepTraffic(state, dt);
  stepPedestrians(state, dt);
  stepPolice(state, dt, audio);
  stepMissions(state, audio);
  stepCombat(state, actions, dt, audio);
  stepPickups(state, audio);
  stepWantedDecay(state, dt);
  stepParticles(state, dt);

  if (state.wanted === 0 && state.health < 100) state.health = Math.min(100, state.health + 2 * dt);
  if (audio) {
    const carSpeed = p.onFoot ? 0 : Math.abs(p.car ? p.car.speed : 0);
    audio.setEngine(carSpeed, !p.onFoot);
    audio.setSiren(state.wanted > 0);
    audio.update(dt);
  }
}

function stepPedestrians(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    ped.turnT -= dt;
    const playerNear = dist(ped.x, ped.y, p.x, p.y) < 260;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      movePed(state, ped, away, 150, dt);
      continue;
    }
    if (playerNear && state.wanted >= 2 && !p.onFoot && p.car && Math.abs(p.car.speed) > 200) {
      ped.flee = 1.5;
      continue;
    }
    if (ped.turnT <= 0) {
      ped.turnT = state.rng.range(2, 7);
      ped.angle += state.rng.pick([-Math.PI / 2, Math.PI / 2, Math.PI]);
    }
    movePed(state, ped, ped.angle, ped.speed, dt);
  }
}

function movePed(state, ped, angle, speed, dt) {
  const nx = ped.x + Math.cos(angle) * speed * dt;
  const ny = ped.y + Math.sin(angle) * speed * dt;
  if (hitsBuilding(state.buildings, nx, ped.y, 10)) {
    ped.angle += Math.PI / 2;
    return;
  }
  if (hitsBuilding(state.buildings, ped.x, ny, 10)) {
    ped.angle += Math.PI / 2;
    return;
  }
  ped.x = clamp(nx, 110, WORLD_WIDTH - 110);
  ped.y = clamp(ny, 110, WORLD_HEIGHT - 110);
}

function stepPickups(state, audio) {
  const p = state.player;
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    pickup.bob += 0.08;
    if (dist(p.x, p.y, pickup.x, pickup.y) > 34) continue;
    pickup.taken = true;
    if (pickup.kind === 'cash') {
      state.cash += pickup.value;
      state.stats.earned += pickup.value;
      showMessage(state, `+$${pickup.value} cash`);
      if (audio) audio.cash();
    } else if (pickup.kind === 'armor') {
      state.armor = Math.min(100, state.armor + pickup.value);
      showMessage(state, `+${pickup.value} armor`);
      if (audio) audio.pickup();
    } else if (pickup.kind === 'health') {
      state.health = Math.min(100, state.health + pickup.value);
      showMessage(state, `+${pickup.value} health`);
      if (audio) audio.pickup();
    } else if (pickup.kind === 'ammo') {
      state.ammo += pickup.value;
      showMessage(state, `+${pickup.value} pistol ammo`);
      if (audio) audio.pickup();
    }
    burst(state, pickup.x, pickup.y, '#ffd94a', 10);
  }
}

function stepWantedDecay(state, dt) {
  if (state.wanted <= 0) return;
  let nearest = Infinity;
  for (const cruiser of state.cruisers) nearest = Math.min(nearest, dist(cruiser.x, cruiser.y, state.player.x, state.player.y));
  for (const cop of state.cops) nearest = Math.min(nearest, dist(cop.x, cop.y, state.player.x, state.player.y));
  if (nearest > 550 || (state.cruisers.length === 0 && state.cops.length === 0)) {
    state.hiddenTime += dt;
    if (state.hiddenTime > WANTED_HIDE_SECONDS) {
      state.dropTimer += dt;
      if (state.dropTimer >= WANTED_DROP_SECONDS) {
        state.wanted -= 1;
        state.dropTimer = 0;
        if (state.wanted === 0) {
          // Nobody is chasing any more: the cruisers and foot cops give up
          // and drive off instead of lingering around the player.
          state.cruisers = [];
          state.cops = [];
          showMessage(state, 'You lost the heat. Wanted level clear.');
        }
      }
    }
  } else {
    state.hiddenTime = 0;
    state.dropTimer = 0;
  }
}

function stepParticles(state, dt) {
  for (let i = state.parts.length - 1; i >= 0; i -= 1) {
    const part = state.parts[i];
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vx *= 0.94;
    part.vy *= 0.94;
    part.life -= dt;
    if (part.life <= 0) state.parts.splice(i, 1);
  }
}

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: state.cash, health: state.health, armor: state.armor, ammo: state.ammo,
      clock: state.clock, missionIndex: state.missionIndex, missionStage: state.missionStage,
      missionsDone: state.missionsDone, bagsCollected: state.bagsCollected,
      stats: state.stats, px: state.player.x, py: state.player.y,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return false;
    state.cash = data.cash;
    state.health = data.health;
    state.armor = data.armor;
    state.ammo = data.ammo;
    state.clock = data.clock;
    state.missionIndex = data.missionIndex;
    state.missionStage = data.missionStage;
    state.missionsDone = data.missionsDone || [];
    state.bagsCollected = data.bagsCollected || 0;
    state.stats = { ...state.stats, ...(data.stats || {}) };
    state.player.x = data.px;
    state.player.y = data.py;
    state.player.onFoot = true;
    state.player.car = null;
    return true;
  } catch {
    return false;
  }
}
