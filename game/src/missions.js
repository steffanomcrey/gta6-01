// The story: three missions with markers, objectives and cash rewards, plus
// the taxi side job that pays fares while the player drives the cab.
import {
  MISSION_REWARDS, ROADS_X, ROADS_Y, FARE_MIN, FARE_MAX,
  clamp, dist,
} from './config.js';
import { showMessage, burst } from './world.js';

export const MISSIONS = [
  { name: 'First Fare', brief: 'Take the taxi, pick up at Downtown Plaza, drop off at the Docks.' },
  { name: 'Palms Cash Run', brief: 'Collect 3 cash bags stashed around Palms.' },
  { name: 'Heat Run', brief: 'Raise the heat to 3 stars, then lose it at the east hideout.' },
];

export const TAXI_SPOT = { x: 1440, y: 1000 };
export const PLAZA_SPOT = { x: 2040, y: 1240 };
export const DOCKS_SPOT = { x: 2960, y: 1840 };
export const HIDEOUT_SPOT = { x: 2700, y: 2160 };
export const BAG_SPOTS = [
  { x: 640, y: 1840 },
  { x: 1040, y: 2160 },
  { x: 240, y: 1440 },
];
const BAG_VALUE = 25;
const FARE_LIFETIME = 90;

// The marker the HUD and the minimap point at, or null when the current
// stage has no place to go (mission 3, stage 0: make trouble anywhere).
export function currentMarker(state) {
  if (state.missionIndex === 0) {
    if (state.missionStage === 0) return { ...TAXI_SPOT, label: 'Taxi' };
    if (state.missionStage === 1) return { ...PLAZA_SPOT, label: 'Downtown Plaza' };
    return { ...DOCKS_SPOT, label: 'The Docks' };
  }
  if (state.missionIndex === 1) {
    const spot = BAG_SPOTS[state.bagsCollected];
    if (spot) return { ...spot, label: `Cash bag ${state.bagsCollected + 1} of 3` };
    return null;
  }
  if (state.missionIndex === 2) {
    if (state.missionStage === 0) return null;
    return { ...HIDEOUT_SPOT, label: 'Hideout' };
  }
  if (state.fare) {
    if (state.fare.stage === 0) return { x: state.fare.px, y: state.fare.py, label: 'Fare pickup' };
    return { x: state.fare.dx, y: state.fare.dy, label: 'Fare drop-off' };
  }
  return null;
}

export function missionObjective(state) {
  if (state.missionIndex === 0) {
    if (state.missionStage === 0) return 'MISSION 1/3: First Fare - get in the yellow taxi (E)';
    if (state.missionStage === 1) return 'MISSION 1/3: First Fare - pick up at Downtown Plaza';
    return 'MISSION 1/3: First Fare - drop off at the Docks';
  }
  if (state.missionIndex === 1) {
    return `MISSION 2/3: Palms Cash Run - cash bag ${state.bagsCollected + 1} of 3`;
  }
  if (state.missionIndex === 2) {
    if (state.missionStage === 0) return 'MISSION 3/3: Heat Run - raise wanted to 3 stars';
    return 'MISSION 3/3: Heat Run - reach the east hideout while wanted';
  }
  if (state.fare) {
    return state.fare.stage === 0 ? 'TAXI: pick up the rider' : 'TAXI: drop the rider off';
  }
  return 'ALL MISSIONS COMPLETE - free roam Neon Bay';
}

function completeMission(state, audio, reward) {
  const index = state.missionIndex;
  state.cash += reward;
  state.stats.earned += reward;
  state.missionsDone.push(index + 1);
  state.missionIndex += 1;
  state.missionStage = 0;
  showMessage(state, `Mission complete! +$${reward}`);
  if (audio) audio.missionDone();
  if (state.missionIndex === 1) showMessage(state, `Mission 1 done! +$${reward} - Mission 2: collect cash bags in Palms.`);
  if (state.missionIndex === 2) showMessage(state, `Mission 2 done! +$${reward} - Mission 3: raise the heat to 3 stars.`);
  if (state.missionIndex >= 3) {
    state.over = 'complete';
    state.overTimer = 0;
  }
}

export function stepMissions(state, audio) {
  const p = state.player;
  if (state.missionIndex === 0) {
    if (state.missionStage === 0) {
      if (!p.onFoot && p.car && p.car.missionTaxi) {
        state.missionStage = 1;
        showMessage(state, 'Passenger waiting at Downtown Plaza.');
      }
    } else if (state.missionStage === 1) {
      if (dist(p.x, p.y, PLAZA_SPOT.x, PLAZA_SPOT.y) < 80) {
        state.missionStage = 2;
        showMessage(state, 'Passenger aboard. Drive to the Docks.');
      }
    } else if (dist(p.x, p.y, DOCKS_SPOT.x, DOCKS_SPOT.y) < 80) {
      completeMission(state, audio, MISSION_REWARDS[0]);
    }
  } else if (state.missionIndex === 1) {
    const spot = BAG_SPOTS[state.bagsCollected];
    if (spot && dist(p.x, p.y, spot.x, spot.y) < 44) {
      state.bagsCollected += 1;
      state.cash += BAG_VALUE;
      state.stats.earned += BAG_VALUE;
      burst(state, spot.x, spot.y, '#ffd94a', 12);
      if (audio) audio.cash();
      if (state.bagsCollected >= 3) {
        completeMission(state, audio, MISSION_REWARDS[1]);
      } else {
        showMessage(state, `Cash bag ${state.bagsCollected} of 3. +$${BAG_VALUE}`);
      }
    }
  } else if (state.missionIndex === 2) {
    if (state.missionStage === 0) {
      if (state.wanted >= 3) {
        state.missionStage = 1;
        showMessage(state, 'Heat is on! Lose it at the east hideout.');
      }
    } else if (dist(p.x, p.y, HIDEOUT_SPOT.x, HIDEOUT_SPOT.y) < 90) {
      if (state.wanted >= 1) {
        completeMission(state, audio, MISSION_REWARDS[2]);
      } else {
        showMessage(state, 'Too cold. Get some heat first, then come back.');
      }
    }
  }
  stepTaxiFare(state, audio);
}

// Taxi fares: while the player drives the cab after mission 1, riders flag
// it down. Pick them up, drop them off, get paid by the distance.
function stepTaxiFare(state, audio) {
  const p = state.player;
  const inTaxi = !p.onFoot && p.car && p.car.kind === 'taxi';
  if (!inTaxi) {
    if (state.fare) {
      state.fare = null;
      showMessage(state, 'Fare lost. You left the taxi.');
    }
    return;
  }
  if (state.missionIndex < 1) return;
  if (!state.fare) {
    // Fares only flag the cab down while it is actually rolling, never while
    // it sits parked at a mission drop-off.
    if (!p.car || Math.abs(p.car.speed) < 40) return;
    state.fareTimer = (state.fareTimer || 0) + 1 / 60;
    if (state.fareTimer < 12) return;
    state.fareTimer = 0;
    const px = state.rng.pick(ROADS_X);
    const py = state.rng.pick(ROADS_Y);
    let dx = state.rng.pick(ROADS_X);
    let dy = state.rng.pick(ROADS_Y);
    if (dist(px, py, dx, dy) < 700) {
      dx = clamp(px + 1200, 200, 3000);
      dy = clamp(py - 800, 200, 2200);
    }
    const pay = Math.round(clamp(FARE_MIN + dist(px, py, dx, dy) / 60, FARE_MIN, FARE_MAX));
    state.fare = { px, py, dx, dy, stage: 0, pay, timer: 0 };
    showMessage(state, 'A rider flagged the taxi. Pick them up.');
    return;
  }
  const fare = state.fare;
  fare.timer += 1 / 60;
  if (fare.timer > FARE_LIFETIME) {
    state.fare = null;
    showMessage(state, 'The rider gave up waiting.');
    return;
  }
  if (fare.stage === 0) {
    if (dist(p.x, p.y, fare.px, fare.py) < 70) {
      fare.stage = 1;
      showMessage(state, 'Rider aboard. Take them to the marker.');
    }
  } else if (dist(p.x, p.y, fare.dx, fare.dy) < 70) {
    state.cash += fare.pay;
    state.stats.earned += fare.pay;
    state.stats.faresDone += 1;
    showMessage(state, `Fare paid! +$${fare.pay}`);
    if (audio) audio.cash();
    state.fare = null;
  }
}
