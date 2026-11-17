// The law: wanted stars bring cruisers that chase and ram, and foot cops
// that chase and arrest. The heat only fades once every unit loses sight of
// the player, which world.js tracks as the decay timer.
import {
  CRUISER_SPEED, COP_WALK_SPEED, RAM_DAMAGE, COP_PUNCH_DAMAGE, ROADS_X, ROADS_Y,
  WORLD_WIDTH, WORLD_HEIGHT, MAX_WANTED, hitsBuilding, clamp, dist, angleDelta,
} from './config.js';
import { hurtPlayer, bustPlayer, showMessage, burst } from './world.js';

export function stepPolice(state, dt, audio) {
  const p = state.player;
  const wanted = state.wanted;
  if (wanted <= 0) return;

  const wantCruisers = Math.min(wanted, MAX_WANTED);
  while (state.cruisers.length < wantCruisers) {
    const spot = spawnSpot(state, 700);
    if (!spot) break;
    state.cruisers.push({ x: spot.x, y: spot.y, angle: 0, speed: 0, hp: 4 });
  }
  while (state.cruisers.length > wantCruisers) state.cruisers.pop();

  const wantCops = p.onFoot ? Math.min(wanted, 3) : 0;
  while (state.cops.length < wantCops) {
    const spot = spawnSpot(state, 420);
    if (!spot) break;
    state.cops.push({ x: spot.x, y: spot.y, angle: 0, hp: 3, arrestT: 0, punchCd: 0 });
  }
  while (state.cops.length > wantCops) state.cops.pop();

  for (let i = state.cruisers.length - 1; i >= 0; i -= 1) {
    const cruiser = state.cruisers[i];
    stepCruiser(state, cruiser, dt);
    if (dist(cruiser.x, cruiser.y, p.x, p.y) > 1700) state.cruisers.splice(i, 1);
  }
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    stepCop(state, state.cops[i], dt, audio);
  }
}

// A spawn point on a road, a fair distance from the player so units arrive
// instead of popping in on top of them.
function spawnSpot(state, minDist) {
  const p = state.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const onVertical = state.rng.chance(0.5);
    let x;
    let y;
    if (onVertical) {
      x = state.rng.pick(ROADS_X);
      y = state.rng.range(160, WORLD_HEIGHT - 160);
    } else {
      x = state.rng.range(160, WORLD_WIDTH - 160);
      y = state.rng.pick(ROADS_Y);
    }
    if (dist(x, y, p.x, p.y) >= minDist) return { x, y };
  }
  return null;
}

function stepCruiser(state, cruiser, dt) {
  const p = state.player;
  const target = Math.atan2(p.y - cruiser.y, p.x - cruiser.x);
  const turn = clamp(angleDelta(cruiser.angle, target), -2.6 * dt, 2.6 * dt);
  cruiser.angle += turn;
  cruiser.speed = Math.min(CRUISER_SPEED, cruiser.speed + 320 * dt);
  const nx = cruiser.x + Math.cos(cruiser.angle) * cruiser.speed * dt;
  const ny = cruiser.y + Math.sin(cruiser.angle) * cruiser.speed * dt;
  // Axis-separated slide so a cruiser grinds along a building instead of
  // sticking to it while it chases.
  if (!hitsBuilding(state.buildings, nx, cruiser.y, 22)) cruiser.x = nx;
  else cruiser.speed *= 0.5;
  if (!hitsBuilding(state.buildings, cruiser.x, ny, 22)) cruiser.y = ny;
  else cruiser.speed *= 0.5;
  cruiser.x = clamp(cruiser.x, 40, WORLD_WIDTH - 40);
  cruiser.y = clamp(cruiser.y, 40, WORLD_HEIGHT - 40);

  const d = dist(cruiser.x, cruiser.y, p.x, p.y);
  if (d < 52) {
    if (!p.onFoot && p.car) {
      p.car.speed *= 0.55;
      cruiser.speed *= 0.4;
    }
    hurtPlayer(state, RAM_DAMAGE);
    burst(state, cruiser.x, cruiser.y, '#ff5a3c', 6);
  }
}

function stepCop(state, cop, dt, audio) {
  const p = state.player;
  const target = Math.atan2(p.y - cop.y, p.x - cop.x);
  cop.angle = target;
  const d = dist(cop.x, cop.y, p.x, p.y);
  if (cop.punchCd > 0) cop.punchCd -= dt;
  if (d > 30) {
    const nx = cop.x + Math.cos(target) * COP_WALK_SPEED * dt;
    const ny = cop.y + Math.sin(target) * COP_WALK_SPEED * dt;
    if (!hitsBuilding(state.buildings, nx, cop.y, 12)) cop.x = nx;
    if (!hitsBuilding(state.buildings, cop.x, ny, 12)) cop.y = ny;
    cop.x = clamp(cop.x, 30, WORLD_WIDTH - 30);
    cop.y = clamp(cop.y, 30, WORLD_HEIGHT - 30);
    cop.arrestT = 0;
  } else if (p.onFoot) {
    // A cop on top of the player on foot is making the arrest.
    cop.arrestT += dt;
    if (cop.punchCd <= 0) {
      cop.punchCd = 1.1;
      hurtPlayer(state, COP_PUNCH_DAMAGE);
    }
    if (cop.arrestT > 1.2) {
      bustPlayer(state, audio);
      return;
    }
  } else {
    // The player is in a car: the cop bangs on the window and waits.
    if (cop.punchCd <= 0) {
      cop.punchCd = 1.4;
      showMessage(state, 'A cop is pulling at your door. Drive!');
    }
  }
}
