// Keyboard and mouse state for MORVANE.
// The game reads this module, never the DOM directly, so the loop and the
// deterministic shot scenes share one input model. Coordinates are in canvas
// pixels (the canvas is a fixed 1280x720), converted from client pixels by
// the scale the canvas is drawn at.

export const input = {
  // keys currently held, by KeyboardEvent.code
  keys: new Set(),
  // keys pressed since the last frame was consumed (edge-triggered)
  pressed: new Set(),
  // mouse position in canvas pixels
  mouseX: 640,
  mouseY: 360,
  // mouse buttons currently held
  mouseDown: false,
  mousePressed: false,
  // true once the player has used the mouse at all (aim follows keys until then)
  mouseSeen: false,
};

let canvas = null;

function toCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 1280;
  const y = ((clientY - rect.top) / rect.height) * 720;
  return { x, y };
}

/** Start listening. Call once, after the canvas exists. */
export function initInput(canvasEl) {
  canvas = canvasEl;
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e.clientX, e.clientY);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.mouseSeen = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toCanvas(e.clientX, e.clientY);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.mouseSeen = true;
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
    }
    if (e.button === 2) input.pressed.add('Dash');
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** True while a key is held. */
export function keyDown(code) {
  return input.keys.has(code);
}

/** True only on the frame the key went down. */
export function keyPressed(code) {
  return input.pressed.has(code);
}

/** True while any of the given keys is held. */
export function anyKeyDown(codes) {
  for (const c of codes) if (input.keys.has(c)) return true;
  return false;
}

/** True if any of the given keys was pressed this frame. */
export function anyKeyPressed(codes) {
  for (const c of codes) if (input.pressed.has(c)) return true;
  return false;
}

/** Clear the edge-triggered sets. Called once per frame, after the update. */
export function endFrameInput() {
  input.pressed.clear();
  input.mousePressed = false;
}
