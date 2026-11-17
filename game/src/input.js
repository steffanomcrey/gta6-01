// Keyboard input: held keys for movement and driving, edge-triggered actions
// for the one-shot commands. takeActions() returns the pressed bits and clears
// them, so the caller reads each press exactly once per frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_PUNCH = 16;
export const ACTION_SAVE = 32;
export const ACTION_MUTE = 64;
export const ACTION_CONTINUE = 128;

const CONFIRM_KEYS = new Set(['Enter', 'Space']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let queued = 0;

  function keyDown(event) {
    const code = event.code;
    if (CONFIRM_KEYS.has(code)) queued |= ACTION_CONFIRM;
    else if (PAUSE_KEYS.has(code)) queued |= ACTION_PAUSE;
    else if (code === 'KeyE') queued |= ACTION_ENTER;
    else if (code === 'KeyJ') queued |= ACTION_SHOOT;
    else if (code === 'KeyK') queued |= ACTION_PUNCH;
    else if (code === 'KeyQ') queued |= ACTION_SAVE;
    else if (code === 'KeyM') queued |= ACTION_MUTE;
    else if (code === 'KeyC') queued |= ACTION_CONTINUE;
    if (!event.repeat) held.add(code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
  }

  function keyUp(event) {
    held.delete(event.code);
  }

  function blur() {
    held.clear();
  }

  target.addEventListener('keydown', keyDown);
  target.addEventListener('keyup', keyUp);
  target.addEventListener('blur', blur);
  // A mouse click on the canvas counts as confirm, so the title screen works
  // with keyboard and mouse alike.
  target.addEventListener('mousedown', () => {
    queued |= ACTION_CONFIRM;
  });

  function isDown(...codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  // On-foot movement vector, normalised so diagonals are not faster.
  function moveVector() {
    let x = 0;
    let y = 0;
    if (isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (isDown('KeyD', 'ArrowRight')) x += 1;
    if (isDown('KeyW', 'ArrowUp')) y -= 1;
    if (isDown('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  // Driving: +1 throttle, -1 brake/reverse, 0 coasting.
  function throttle() {
    if (isDown('KeyW', 'ArrowUp')) return 1;
    if (isDown('KeyS', 'ArrowDown')) return -1;
    return 0;
  }

  // Steering: -1 left, +1 right.
  function steer() {
    if (isDown('KeyA', 'ArrowLeft')) return -1;
    if (isDown('KeyD', 'ArrowRight')) return 1;
    return 0;
  }

  function takeActions() {
    const actions = queued;
    queued = 0;
    return actions;
  }

  return { moveVector, throttle, steer, takeActions, isDown };
}
