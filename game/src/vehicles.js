// Cars: traffic that cruises the road grid, and the player's own driving
// physics (throttle, steering that needs speed, braking, wall bounces).
import {
  WORLD_WIDTH, WORLD_HEIGHT, ROADS_X, ROADS_Y, CAR_TOP_SPEED, CAR_REVERSE_SPEED,
  CAR_ACCEL, CAR_BRAKE, PALETTE, hitsBuilding, clamp, dist,
} from './config.js';
import { addWanted, showMessage, burst } from './world.js';

export function makeCar(rng, x, y, angle, kind, color) {
  return {
    x, y, angle, speed: 0, kind, color,
    driven: false, missionTaxi: false,
    // Traffic state: which road it follows and which way along it.
    axis: 'v', road: 0, dir: 1, cruise: rng ? rng.range(60, 110) : 80,
  };
}

export function spawnTrafficCars(state, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    const onVertical = rng.chance(0.5);
    let x;
    let y;
    let angle;
    let axis;
    let road;
    let dir;
    if (onVertical) {
      road = rng.pick(ROADS_X);
      dir = rng.pick([-1, 1]);
      x = road + rng.pick([-18, 18]);
      y = rng.range(200, WORLD_HEIGHT - 200);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      axis = 'v';
    } else {
      road = rng.pick(ROADS_Y);
      dir = rng.pick([-1, 1]);
      x = rng.range(200, WORLD_WIDTH - 200);
      y = road + rng.pick([-18, 18]);
      angle = dir > 0 ? 0 : Math.PI;
      axis = 'h';
    }
    const kinds = ['sedan', 'sedan', 'sedan', 'sport', 'truck'];
    const car = makeCar(rng, x, y, angle, rng.pick(kinds), rng.pick(PALETTE.carColors));
    car.axis = axis;
    car.road = road;
    car.dir = dir;
    state.cars.push(car);
  }
}

// Traffic follows its road; at an intersection it sometimes turns onto the
// cross road, and it stops short of the player's car instead of ramming it.
export function stepTraffic(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driven || car.parked) continue;
    let speed = car.cruise;
    if (!p.onFoot && p.car) {
      const ahead = dist(car.x, car.y, p.car.x, p.car.y);
      if (ahead < 78) speed = 0;
      // A car the player is tailgating speeds up instead of blocking the
      // road forever: the player can always get past slow traffic.
      else if (ahead < 130 && tailgating(car, p.car)) speed = car.cruise + 170;
    }
    if (car.axis === 'v') {
      car.y += car.dir * speed * dt;
      if (car.y < 130 || car.y > WORLD_HEIGHT - 130) {
        car.dir *= -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      maybeTurn(state, car, 'v');
    } else {
      car.x += car.dir * speed * dt;
      if (car.x < 130 || car.x > WORLD_WIDTH - 130) {
        car.dir *= -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
      maybeTurn(state, car, 'h');
    }
    car.speed = speed;
    // Keep a gap to the car ahead on the same road so traffic never stacks.
    for (const other of state.cars) {
      if (other === car || other.driven || other.axis !== car.axis || other.road !== car.road) continue;
      const gap = (car.axis === 'v' ? other.y - car.y : other.x - car.x) * car.dir;
      if (gap > 0 && gap < 70) {
        if (car.axis === 'v') car.y -= car.dir * speed * dt * 0.9;
        else car.x -= car.dir * speed * dt * 0.9;
      }
    }
  }
}

// True when the player's car sits right behind a traffic car on the same
// road, heading the same way: the traffic car is holding the player up.
function tailgating(traffic, playerCar) {
  if (traffic.axis === 'v') {
    if (Math.abs(traffic.x - playerCar.x) > 44) return false;
    const behind = (playerCar.y - traffic.y) * traffic.dir;
    return behind < 0;
  }
  if (Math.abs(traffic.y - playerCar.y) > 44) return false;
  const behind = (playerCar.x - traffic.x) * traffic.dir;
  return behind < 0;
}

function maybeTurn(state, car, axis) {
  const cross = axis === 'v' ? ROADS_Y : ROADS_X;
  const along = axis === 'v' ? car.y : car.x;
  for (const line of cross) {
    if (Math.abs(along - line) < 14 && state.rng.chance(0.22)) {
      if (axis === 'v') {
        car.axis = 'h';
        car.road = line;
        car.dir = state.rng.pick([-1, 1]);
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.y = line + state.rng.pick([-18, 18]);
      } else {
        car.axis = 'v';
        car.road = line;
        car.dir = state.rng.pick([-1, 1]);
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = line + state.rng.pick([-18, 18]);
      }
      return;
    }
  }
}

// The player's car: arcade handling, steering that scales with speed and
// flips in reverse, a bounce off buildings, and a nudge off traffic.
export function stepPlayerCar(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) {
    p.onFoot = true;
    return;
  }
  const thr = input.throttle();
  const str = input.steer();
  const moving = Math.abs(car.speed) > 4;
  if (moving) {
    const grip = clamp(Math.abs(car.speed) / 180, 0, 1);
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += str * 2.3 * grip * dir * dt;
  }
  if (thr > 0) car.speed += CAR_ACCEL * dt;
  else if (thr < 0) {
    if (car.speed > 12) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.55 * dt;
  } else {
    const drag = 130 * dt;
    if (Math.abs(car.speed) <= drag) car.speed = 0;
    else car.speed -= Math.sign(car.speed) * drag;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE_SPEED, CAR_TOP_SPEED);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Axis-separated moves: a wall blocks one axis while the other still
  // slides, so a car grinding along a building face slips around its corner
  // instead of wedging nose-first into it.
  if (hitsBuilding(state.buildings, nx, car.y, 22)) car.speed *= 0.5;
  else car.x = clamp(nx, 40, WORLD_WIDTH - 40);
  if (hitsBuilding(state.buildings, car.x, ny, 22)) car.speed *= 0.5;
  else car.y = clamp(ny, 40, WORLD_HEIGHT - 40);
  for (const other of state.cars) {
    if (other === car || other.driven) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 46 && d > 0.01) {
      const push = (46 - d) / 2;
      const a = Math.atan2(car.y - other.y, car.x - other.x);
      car.x += Math.cos(a) * push;
      car.y += Math.sin(a) * push;
      other.x -= Math.cos(a) * push;
      other.y -= Math.sin(a) * push;
      car.speed *= 0.55;
      burst(state, car.x, car.y, '#c9c9c9', 4);
    }
  }
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    if (Math.abs(car.speed) > 120 && dist(car.x, car.y, ped.x, ped.y) < 28) {
      ped.down = 10;
      ped.flee = 0;
      state.stats.pedsDown += 1;
      addWanted(state, 1, 'Pedestrian hit! Wanted level up.');
      burst(state, ped.x, ped.y, '#e84a3b', 10);
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.moving = Math.abs(car.speed) > 4;
}
