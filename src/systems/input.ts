// Input state - global singleton for input handling
export interface InputState {
  // Keyboard
  keys: Set<string>;
  keysPressed: Set<string>;
  // Mouse
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  mousePressed: boolean;  // True only on the frame mouse was pressed
  mouseReleased: boolean; // True only on the frame mouse was released
}

let inputState: InputState = {
  keys: new Set(),
  keysPressed: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  mousePressed: false,
  mouseReleased: false,
};

let previousMouseDown = false;
const previousKeys = new Set<string>();

export function initInput(canvas: HTMLCanvasElement): void {
  // Keyboard events
  window.addEventListener("keydown", (e) => {
    inputState.keys.add(e.code);
  });

  window.addEventListener("keyup", (e) => {
    inputState.keys.delete(e.code);
  });

  // Mouse events
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    inputState.mouseX = e.clientX - rect.left;
    inputState.mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener("mousedown", () => {
    inputState.mouseDown = true;
  });

  canvas.addEventListener("mouseup", () => {
    inputState.mouseDown = false;
  });

  // Prevent context menu on right click
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Call at the start of each frame to update edge-triggered states
export function updateInput(): void {
  inputState.mousePressed = inputState.mouseDown && !previousMouseDown;
  inputState.mouseReleased = !inputState.mouseDown && previousMouseDown;
  previousMouseDown = inputState.mouseDown;

  inputState.keysPressed.clear();
  for (const key of inputState.keys) {
    if (!previousKeys.has(key)) {
      inputState.keysPressed.add(key);
    }
  }
  previousKeys.clear();
  for (const key of inputState.keys) {
    previousKeys.add(key);
  }
}

export function getInput(): InputState {
  return inputState;
}

// Helper functions for common checks
export function isKeyDown(code: string): boolean {
  return inputState.keys.has(code);
}

export function isKeyPressed(code: string): boolean {
  return inputState.keysPressed.has(code);
}

export function isMovingUp(): boolean {
  return inputState.keys.has("KeyW") || inputState.keys.has("ArrowUp");
}

export function isMovingDown(): boolean {
  return inputState.keys.has("KeyS") || inputState.keys.has("ArrowDown");
}

export function isMovingLeft(): boolean {
  return inputState.keys.has("KeyA") || inputState.keys.has("ArrowLeft");
}

export function isMovingRight(): boolean {
  return inputState.keys.has("KeyD") || inputState.keys.has("ArrowRight");
}
