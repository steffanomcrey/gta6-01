// Combat: the pistol (J) and fists (K). Bullets fly straight and die on
// walls, cops and cruisers; a punch is a short arc in front of the player.
// Shooting a cop or a bystander is a crime and raises the wanted level.
import {
  BULLET_SPEED, WORLD_WIDTH, WORLD_HEIGHT, hitsBuilding, dist,
} from './config.js';
import { ACTION_SHOOT, ACTION_PUNCH } from './input.js';
import { addWanted, showMessage, burst } from './world.js';

const PUNCH_RANGE = 48;
const PUNCH_ARC = Math.PI / 3;

export function stepCombat(state, actions, dt, audio) {
  const p = state.player;
  if ((actions & ACTION_SHOOT) && p.shootCd <= 0) {
    if (state.ammo > 0) {
      state.ammo -= 1;
      state.stats.shotsFired += 1;
      p.shootCd = 0.28;
      const nose = p.onFoot ? 20 : 30;
      state.bullets.push({
        x: p.x + Math.cos(p.angle) * nose,
        y: p.y + Math.sin(p.angle) * nose,
        vx: Math.cos(p.angle) * BULLET_SPEED,
        vy: Math.sin(p.angle) * BULLET_SPEED,
        life: 1.1,
      });
      burst(state, p.x + Math.cos(p.angle) * nose, p.y + Math.sin(p.angle) * nose, '#ffd94a', 3);
      if (audio) audio.shoot();
    } else {
      showMessage(state, 'Out of ammo. Find an ammo pickup (green).');
    }
  }
  if ((actions & ACTION_PUNCH) && p.punchCd <= 0) {
    p.punchT = 0.25;
    p.punchCd = 0.45;
    throwPunch(state, audio);
  }
  stepBullets(state, dt, audio);
}

function throwPunch(state, audio) {
  const p = state.player;
  let hitSomething = false;
  for (const cop of state.cops) {
    if (inArc(p, cop.x, cop.y)) {
      cop.hp -= 1;
      hitSomething = true;
      burst(state, cop.x, cop.y, '#e84a3b', 8);
      if (cop.hp <= 0) {
        state.cops.splice(state.cops.indexOf(cop), 1);
        state.stats.copsDown += 1;
        addWanted(state, 1, 'Cop down! Wanted level up.');
      }
      break;
    }
  }
  if (!hitSomething) {
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (inArc(p, ped.x, ped.y)) {
        ped.down = 6;
        ped.flee = 0;
        state.stats.pedsDown += 1;
        addWanted(state, 1, 'You hit a bystander! Wanted level up.');
        burst(state, ped.x, ped.y, '#e84a3b', 8);
        hitSomething = true;
        break;
      }
    }
  }
  if (audio) audio.punch();
}

function inArc(p, x, y) {
  if (dist(p.x, p.y, x, y) > PUNCH_RANGE) return false;
  const toTarget = Math.atan2(y - p.y, x - p.x);
  let d = toTarget - p.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) < PUNCH_ARC;
}

function stepBullets(state, dt, audio) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && (b.x < 0 || b.y < 0 || b.x > WORLD_WIDTH || b.y > WORLD_HEIGHT)) dead = true;
    if (!dead && hitsBuilding(state.buildings, b.x, b.y, 2)) {
      burst(state, b.x, b.y, '#c9c9c9', 3);
      dead = true;
    }
    if (!dead) {
      for (const cop of state.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 18) {
          cop.hp -= 1;
          burst(state, cop.x, cop.y, '#e84a3b', 8);
          if (cop.hp <= 0) {
            state.cops.splice(state.cops.indexOf(cop), 1);
            state.stats.copsDown += 1;
            addWanted(state, 1, 'Cop down! Wanted level up.');
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 16) {
          ped.down = 8;
          state.stats.pedsDown += 1;
          addWanted(state, 1, 'Bystander shot! Wanted level up.');
          burst(state, ped.x, ped.y, '#e84a3b', 8);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let c = state.cruisers.length - 1; c >= 0; c -= 1) {
        const cruiser = state.cruisers[c];
        if (dist(b.x, b.y, cruiser.x, cruiser.y) < 28) {
          cruiser.hp -= 1;
          burst(state, cruiser.x, cruiser.y, '#ff5a3c', 8);
          if (cruiser.hp <= 0) {
            state.cruisers.splice(c, 1);
            addWanted(state, 1, 'Cruiser disabled! Wanted level up.');
            burst(state, cruiser.x, cruiser.y, '#ff8a3c', 18);
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}
