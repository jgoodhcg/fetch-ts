import { Application, Text } from "pixi.js";
import { createWorld, addEntity, addComponent } from "bitecs";
import {
  Position,
  Velocity,
  Sprite,
  Player,
  DogAI,
  DogState,
  Ball,
  BallState,
  ThrowCharge,
} from "./components.ts";
import { initInput, updateInput } from "./systems/input.ts";
import { playerMovementSystem, boundsSystem } from "./systems/movement.ts";
import { throwSystem } from "./systems/throw.ts";
import { ballPhysicsSystem } from "./systems/ball.ts";
import { dogAISystem } from "./systems/dogAI.ts";
import { initRenderSystem, renderSystem } from "./systems/render.ts";

const WIDTH = 800;
const HEIGHT = 600;

// Colors
const PLAYER_COLOR = 0x4a90d9;
const DOG_COLOR = 0xc4813d;
const BALL_COLOR = 0xff6b6b;
const GROUND_COLOR = 0x5a8f5a;

// Create player entity
function createPlayer(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const eid = addEntity(world);

  addComponent(world, eid, Position);
  addComponent(world, eid, Player);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, ThrowCharge);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Player.speed[eid] = 200;
  Sprite.color[eid] = PLAYER_COLOR;
  Sprite.radius[eid] = 20;
  ThrowCharge.active[eid] = 0;
  ThrowCharge.power[eid] = 0;

  return eid;
}

// Create dog entity
function createDog(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const eid = addEntity(world);

  addComponent(world, eid, Position);
  addComponent(world, eid, DogAI);
  addComponent(world, eid, Sprite);

  Position.x[eid] = x;
  Position.y[eid] = y;
  DogAI.state[eid] = DogState.Idle;
  DogAI.speed[eid] = 250;
  DogAI.excited[eid] = 0;
  Sprite.color[eid] = DOG_COLOR;
  Sprite.radius[eid] = 18;

  return eid;
}

// Create ball entity
function createBall(world: ReturnType<typeof createWorld>, playerEid: number): number {
  const eid = addEntity(world);

  addComponent(world, eid, Position);
  addComponent(world, eid, Velocity);
  addComponent(world, eid, Ball);
  addComponent(world, eid, Sprite);

  Position.x[eid] = Position.x[playerEid]! + 25;
  Position.y[eid] = Position.y[playerEid]!;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Ball.state[eid] = BallState.HeldByPlayer;
  Ball.friction[eid] = 0.98;
  Ball.heldBy[eid] = playerEid;
  Sprite.color[eid] = BALL_COLOR;
  Sprite.radius[eid] = 10;

  return eid;
}

async function main() {
  // Initialize Pixi
  const app = new Application();
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: GROUND_COLOR,
  });
  document.body.appendChild(app.canvas);

  // Initialize input
  initInput(app.canvas as HTMLCanvasElement);

  // Initialize ECS world
  const world = createWorld();

  // Initialize render system
  initRenderSystem(app.stage);

  // Spawn entities
  const playerEid = createPlayer(world, WIDTH / 2, HEIGHT / 2);
  createDog(world, WIDTH / 2 - 100, HEIGHT / 2 + 50);
  createBall(world, playerEid);

  // Instructions text
  const instructionsText = new Text({
    text: "WASD/Arrows: Move | Hold Mouse: Charge | Release: Throw",
    style: { fontSize: 14, fill: 0xffffff },
  });
  instructionsText.anchor.set(0.5, 1);
  instructionsText.x = WIDTH / 2;
  instructionsText.y = HEIGHT - 10;
  app.stage.addChild(instructionsText);

  // Title
  const titleText = new Text({
    text: "Fetch!",
    style: { fontSize: 24, fill: 0xffffff, fontWeight: "bold" },
  });
  titleText.anchor.set(0.5, 0);
  titleText.x = WIDTH / 2;
  titleText.y = 10;
  app.stage.addChild(titleText);

  // FPS counter
  const fpsText = new Text({
    text: "",
    style: { fontSize: 12, fill: 0xffffff },
  });
  fpsText.x = 10;
  fpsText.y = 10;
  app.stage.addChild(fpsText);

  // Game loop
  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000; // Convert to seconds

    // Update input state
    updateInput();

    // Run simulation systems
    playerMovementSystem(world, dt);
    boundsSystem(world, WIDTH, HEIGHT, 25);
    throwSystem(world, dt);
    ballPhysicsSystem(world, dt, WIDTH, HEIGHT);
    dogAISystem(world, dt);

    // Render
    renderSystem(world);

    // Update FPS
    fpsText.text = `FPS: ${Math.round(app.ticker.FPS)}`;
  });
}

main();
