// Boot and the one loop: actions are read once per frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between title, play, paused and game-over screens.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import { createGame, stepGame, saveGame, loadGame } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_SAVE, ACTION_MUTE, ACTION_CONTINUE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
let game = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
// Exposed for playtests and debugging: the live game state, read-only by
// convention. The game itself never reads this back.
window.__neonBay = game;

function saveExists() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

function runShot(name) {
  const scene = stageShot(name, game);
  // The staged state paints twice only, so snap the camera onto the player
  // instead of letting it lerp in from the corner.
  renderer.snapTo(game.player.x, game.player.y);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen, { saveExists: saveExists() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(window);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    game = createGame(seed);
    window.__neonBay = game;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Neon Bay. First job: get in the yellow taxi.');
  }

  function continueGame() {
    game = createGame(seed);
    window.__neonBay = game;
    loadGame(game);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Continuing your saved game.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (game.over === 'complete') announce('Neon Bay conquered. All missions complete.');
    else if (game.over === 'busted') announce('Busted. The police caught you.');
    else announce('Wasted. You went down in Neon Bay.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) {
      announce(saveGame(game) ? 'Game saved.' : 'Could not save.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      else if (actions & ACTION_CONTINUE && saveExists()) continueGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      if ((actions & ACTION_CONFIRM) && game.overTimer > 0.8) startGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let actions = input.takeActions();
    if (actions !== 0) audio.unlock();
    handleActions(actions);
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic and pedestrians run on.
      while (accumulator >= STEP) {
        stepGame(game, input, 0, audio, STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(game, input, actions, audio, STEP);
        actions = 0;
        accumulator -= STEP;
        if (game.over) {
          endGame();
          break;
        }
      }
    } else if (screen === SCREEN_OVER) {
      // The city keeps moving behind the game-over screen.
      while (accumulator >= STEP) {
        stepGame(game, input, 0, audio, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen, { saveExists: saveExists() });
  }

  // Leaving the tab pauses a running game rather than letting the law catch
  // the player unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
