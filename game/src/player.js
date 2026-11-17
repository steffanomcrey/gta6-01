// The player on foot: walking with wall slide, and getting in and out of cars.
// Driving itself lives in vehicles.js; this file only owns the person.
import {
  PLAYER_WALK_SPEED, PLAYER_RADIUS, WORLD_WIDTH, WORLD_HEIGHT,
  hitsBuilding, clamp, dist,
} from './config.js';
import { addWanted, showMessage, burst } from './world.js';

export function stepPlayerOnFoot(state, input, dt) {
  const p = state.player;
  const v = input.moveVector();
  p.moving = v.x !== 0 || v.y !== 0;
  if (p.moving) p.angle = Math.atan2(v.y, v.x);
  const nx = p.x + v.x * PLAYER_WALK_SPEED * dt;
  const ny = p.y + v.y * PLAYER_WALK_SPEED * dt;
  // Axis-separated moves: a wall blocks one axis while the other still slides.
  if (!hitsBuilding(state.buildings, nx, p.y, PLAYER_RADIUS)) {
    p.x = clamp(nx, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
  }
  if (!hitsBuilding(state.buildings, p.x, ny, PLAYER_RADIUS)) {
    p.y = clamp(ny, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
  }
}

export function nearestCar(state, maxDist) {
  const p = state.player;
  let best = null;
  let bestDist = maxDist;
  for (const car of state.cars) {
    if (car.driven) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

export function enterNearestCar(state, audio) {
  const p = state.player;
  const car = nearestCar(state, 64);
  if (!car) {
    showMessage(state, 'No car close enough. Walk up to one and press E.');
    return false;
  }
  p.car = car;
  p.onFoot = false;
  car.driven = true;
  car.parked = false;
  car.speed = 0;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (car.missionTaxi && state.missionIndex === 0 && state.missionStage === 0) {
    showMessage(state, 'Taxi taken. Drive to Downtown Plaza.');
  } else if (car.kind === 'taxi') {
    showMessage(state, 'In the taxi. Fares pay when you drop riders off.');
  } else {
    state.stats.carsStolen += 1;
    addWanted(state, 1, 'Car stolen! The law is on to you.');
    burst(state, car.x, car.y, '#ffd94a', 8);
  }
  if (audio) audio.click();
  return true;
}

export function exitPlayerCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driven = false;
  car.speed = 0;
  // Step out on the car's left side, clear of its body.
  const side = car.angle + Math.PI / 2;
  let x = car.x + Math.cos(side) * 34;
  let y = car.y + Math.sin(side) * 34;
  if (hitsBuilding(state.buildings, x, y, PLAYER_RADIUS)) {
    x = car.x - Math.cos(side) * 34;
    y = car.y - Math.sin(side) * 34;
  }
  p.x = clamp(x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
  p.y = clamp(y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
  p.angle = car.angle;
  p.car = null;
  p.onFoot = true;
  p.punchT = 0;
  p.punchCd = 0;
}
