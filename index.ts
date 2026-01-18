import { Application, Graphics, Text } from "pixi.js";
import { createWorld, addEntity, addComponent, query, soa } from "bitecs";

// Define ECS components using soa (Struct of Arrays)
const Position = soa({
  x: new Float32Array(1000),
  y: new Float32Array(1000),
});

const Velocity = soa({
  x: new Float32Array(1000),
  y: new Float32Array(1000),
});

// Movement system
function movementSystem(world: ReturnType<typeof createWorld>) {
  const entities = query(world, [Position, Velocity]);
  for (const eid of entities) {
    Position.x[eid] = Position.x[eid]! + Velocity.x[eid]!;
    Position.y[eid] = Position.y[eid]! + Velocity.y[eid]!;
  }
  return world;
}

async function main() {
  // Create Pixi application
  const app = new Application();
  await app.init({
    width: 800,
    height: 600,
    backgroundColor: 0x1a1a2e,
  });
  document.body.appendChild(app.canvas);

  // Create bitECS world
  const world = createWorld();

  // Create an entity
  const entity = addEntity(world);
  addComponent(world, entity, Position);
  addComponent(world, entity, Velocity);

  // Set initial position and velocity
  Position.x[entity] = 400;
  Position.y[entity] = 300;
  Velocity.x[entity] = 2;
  Velocity.y[entity] = 1.5;

  // Create a graphics object for the entity
  const circle = new Graphics();
  circle.circle(0, 0, 20);
  circle.fill(0x16c79a);
  app.stage.addChild(circle);

  // Add title text
  const text = new Text({
    text: "Fetch - TypeScript + bitECS + Pixi.js",
    style: { fontSize: 24, fill: 0xffffff },
  });
  text.anchor.set(0.5);
  text.x = 400;
  text.y = 50;
  app.stage.addChild(text);

  // Game loop
  app.ticker.add(() => {
    // Run ECS systems
    movementSystem(world);

    // Bounce off walls
    if (Position.x[entity]! <= 20 || Position.x[entity]! >= 780) {
      Velocity.x[entity] = Velocity.x[entity]! * -1;
    }
    if (Position.y[entity]! <= 20 || Position.y[entity]! >= 580) {
      Velocity.y[entity] = Velocity.y[entity]! * -1;
    }

    // Sync Pixi graphics with ECS position
    circle.x = Position.x[entity]!;
    circle.y = Position.y[entity]!;
  });
}

main();
