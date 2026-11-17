// Screenshot staging: each ?shot= scene is a real render of the live game,
// driven to the staged state by stepping the world, never by drawing over
// it. The driver in main.js paints the staged state twice and then sets
// window.__shotReady.
import { stepGame } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './render.js';

const STEP = 1 / 60;

// An input that presses nothing, so staged scenes step ambient traffic and
// pedestrians without the player moving.
function idleInput() {
  return {
    moveVector() { return { x: 0, y: 0 }; },
    throttle() { return 0; },
    steer() { return 0; },
    takeActions() { return 0; },
    isDown() { return false; },
  };
}

// An input that holds the throttle, for the chase: the player drives away
// while the cruisers close in.
function driveInput() {
  return {
    moveVector() { return { x: 0, y: 0 }; },
    throttle() { return 1; },
    steer() { return 0; },
    takeActions() { return 0; },
    isDown() { return false; },
  };
}

// Sound is a no-op while staging: screenshots are silent by design.
const silentAudio = {
  setEngine() {}, setSiren() {}, update() {}, click() {}, cash() {},
  missionDone() {}, shoot() {}, punch() {}, pickup() {}, busted() {},
  wasted() {}, horn() {},
};

function putPlayerInTaxi(game, x, y, angle) {
  const taxi = game.cars.find((car) => car.missionTaxi);
  taxi.x = x;
  taxi.y = y;
  taxi.angle = angle;
  taxi.speed = 0;
  taxi.driven = true;
  game.player.car = taxi;
  game.player.onFoot = false;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
}

function cruiserNear(game, maxDist) {
  for (const cruiser of game.cruisers) {
    const dx = cruiser.x - game.player.x;
    const dy = cruiser.y - game.player.y;
    if (Math.sqrt(dx * dx + dy * dy) < maxDist) return true;
  }
  return false;
}

export function stageShot(name, game) {
  const idle = idleInput();
  if (name === 'start') {
    // The title over the living city: six seconds of traffic and pedestrians.
    for (let i = 0; i < 60 * 6; i += 1) stepGame(game, idle, 0, silentAudio, STEP);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    // On the Downtown road in the taxi, mission 1 in progress.
    putPlayerInTaxi(game, 1440, 1000, -Math.PI / 2);
    game.missionStage = 1;
    for (let i = 0; i < 60 * 3; i += 1) stepGame(game, idle, 0, silentAudio, STEP);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Mid-chase: wanted 3, mission 3 on the HUD, cruisers closing in.
    // Start mid-map so the drive ends with city around the player, not the
    // world edge.
    putPlayerInTaxi(game, 1040, 1440, 0);
    game.missionIndex = 2;
    game.missionStage = 1;
    game.wanted = 3;
    game.health = 100;
    game.armor = 50;
    game.cash = 640;
    game.stats.carsStolen = 2;
    const drive = driveInput();
    for (let i = 0; i < 60 * 4; i += 1) {
      stepGame(game, drive, 0, silentAudio, STEP);
      // Stop as soon as a cruiser is on the player's bumper.
      if (i > 60 && cruiserNear(game, 320)) break;
    }
    // Fallback: if no cruiser closed in on its own, put the nearest one on
    // the player's bumper so the shot always shows the chase.
    if (!cruiserNear(game, 320) && game.cruisers.length > 0) {
      let nearest = game.cruisers[0];
      for (const cruiser of game.cruisers) {
        const d = Math.hypot(cruiser.x - game.player.x, cruiser.y - game.player.y);
        const dn = Math.hypot(nearest.x - game.player.x, nearest.y - game.player.y);
        if (d < dn) nearest = cruiser;
      }
      nearest.x = game.player.x - Math.cos(game.player.angle) * 200;
      nearest.y = game.player.y - Math.sin(game.player.angle) * 200;
      nearest.angle = game.player.angle;
      nearest.speed = 400;
    }
    game.health = 100;
    return { screen: SCREEN_PLAY };
  }
  // end: every mission done, the conquered-city screen with the final stats.
  game.missionIndex = 3;
  game.missionsDone = [1, 2, 3];
  game.cash = 1240;
  game.stats.carsStolen = 3;
  game.stats.faresDone = 2;
  game.stats.shotsFired = 11;
  game.over = 'complete';
  game.overTimer = 0;
  for (let i = 0; i < 60; i += 1) stepGame(game, idle, 0, silentAudio, STEP);
  return { screen: SCREEN_OVER };
}
