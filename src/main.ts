import { Application, Text } from "pixi.js";
import { createWorld, addEntity, addComponent } from "bitecs";
import { Position, Velocity, Sprite } from "./components.ts";
import { movementSystem, boundsSystem } from "./systems/movement.ts";
import { initRenderSystem, renderSystem, getRenderStats } from "./systems/render.ts";

const WIDTH = 800;
const HEIGHT = 600;

// Entity factory - creates a ball entity with all required components
function createBall(
  world: ReturnType<typeof createWorld>,
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: number,
  radius: number
): number {
  const eid = addEntity(world);

  addComponent(world, eid, Position);
  addComponent(world, eid, Velocity);
  addComponent(world, eid, Sprite);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Velocity.x[eid] = vx;
  Velocity.y[eid] = vy;
  Sprite.color[eid] = color;
  Sprite.radius[eid] = radius;

  return eid;
}

async function main() {
  // Initialize Pixi
  const app = new Application();
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: 0x1a1a2e,
  });
  document.body.appendChild(app.canvas);

  // Initialize ECS world
  const world = createWorld();

  // Initialize render system with a container for game objects
  initRenderSystem(app.stage);

  // Spawn some test entities
  const ENTITY_COUNT = 100;
  for (let i = 0; i < ENTITY_COUNT; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT;
    const vx = (Math.random() - 0.5) * 4;
    const vy = (Math.random() - 0.5) * 4;
    const color = 0x16c79a + Math.floor(Math.random() * 0x444444);
    const radius = 5 + Math.random() * 10;

    createBall(world, x, y, vx, vy, color, radius);
  }

  // Debug text
  const debugText = new Text({
    text: "",
    style: { fontSize: 14, fill: 0xffffff },
  });
  debugText.x = 10;
  debugText.y = 10;
  app.stage.addChild(debugText);

  // Title
  const titleText = new Text({
    text: "Fetch - TypeScript + bitECS + Pixi.js",
    style: { fontSize: 20, fill: 0xffffff },
  });
  titleText.anchor.set(0.5, 0);
  titleText.x = WIDTH / 2;
  titleText.y = HEIGHT - 35;
  app.stage.addChild(titleText);

  // Game loop - runs systems in order
  app.ticker.add(() => {
    // Simulation systems
    movementSystem(world);
    boundsSystem(world, WIDTH, HEIGHT);

    // Render system - syncs ECS to Pixi
    renderSystem(world);

    // Update debug info
    const stats = getRenderStats();
    debugText.text = `Entities: ${ENTITY_COUNT} | Pool: ${stats.poolSize} | Active: ${stats.active} | FPS: ${Math.round(app.ticker.FPS)}`;
  });
}

main();
