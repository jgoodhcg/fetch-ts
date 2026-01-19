import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite as PixiSprite,
  Text,
  Texture,
} from "pixi.js";
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
import { getInput, initInput, isKeyPressed, updateInput } from "./systems/input.ts";
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
const GROUND_COLOR = 0x63ab3f;
const TILE_SHEET_PATH = "/tiles/GRASS+.png";
const TILE_SIZE = 16;
const TILE_SCALE = 2;
const DEBUG_SHEET_MAX_SCALE = 2;
const DEFAULT_TILE_INDEX = 58;
const NONE_TILE_INDEX = -1;
const NOISE_SCALE = 0.8; // Lower = larger patches
const NOISE_COVERAGE = 0.45; // Approx fraction of tiles to show
const NOISE_OCTAVES = 5;
const NOISE_PERSISTENCE = 0.5;
const NOISE_LACUNARITY = 2.0;
const TILE_WEIGHT_DECAY = 0.3; // Each successive tile is less likely

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

  const isDev = new URLSearchParams(window.location.search).has("dev");

  const grassSheet = await Assets.load({
    src: TILE_SHEET_PATH,
    data: { scaleMode: "nearest" },
  }) as Texture;

  const tileColumns = Math.max(1, Math.floor(grassSheet.width / TILE_SIZE));
  const tileRows = Math.max(1, Math.floor(grassSheet.height / TILE_SIZE));
  const tileCount = tileColumns * tileRows;
  const tileTextures: Texture[] = new Array(tileCount);

  if (tileCount === 0) {
    throw new Error("Tile sheet too small for 16x16 tiles.");
  }

  for (let i = 0; i < tileCount; i += 1) {
    const x = (i % tileColumns) * TILE_SIZE;
    const y = Math.floor(i / tileColumns) * TILE_SIZE;
    tileTextures[i] = new Texture({
      source: grassSheet.source,
      frame: new Rectangle(x, y, TILE_SIZE, TILE_SIZE),
    });
  }

  const wrapTileIndex = (index: number): number => {
    const minIndex = NONE_TILE_INDEX;
    const maxIndex = tileCount - 1;
    const range = maxIndex - minIndex + 1;
    return (((index - minIndex) % range + range) % range) + minIndex;
  };

  let selectedTile = wrapTileIndex(DEFAULT_TILE_INDEX);
  let selectedTiles = [selectedTile];
  let noiseSeed = 1;

  const tilePixelSize = TILE_SIZE * TILE_SCALE;
  const mapColumns = Math.ceil(WIDTH / tilePixelSize);
  const mapRows = Math.ceil(HEIGHT / tilePixelSize);
  const mapSprites: PixiSprite[] = new Array(mapColumns * mapRows);
  const mapContainer = new Container();
  app.stage.addChildAt(mapContainer, 0);

  let spriteIndex = 0;
  for (let row = 0; row < mapRows; row += 1) {
    for (let col = 0; col < mapColumns; col += 1) {
      const sprite = new PixiSprite(tileTextures[0]);
      sprite.x = col * tilePixelSize;
      sprite.y = row * tilePixelSize;
      sprite.scale.set(TILE_SCALE);
      mapContainer.addChild(sprite);
      mapSprites[spriteIndex] = sprite;
      spriteIndex += 1;
    }
  }

  const hash2D = (x: number, y: number, seed: number): number => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return h;
  };

  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  const gradient = (x: number, y: number, seed: number): { x: number; y: number } => {
    const h = hash2D(x, y, seed);
    const angle = (h / 0xffffffff) * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  };

  const perlin2 = (x: number, y: number, seed: number): number => {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;

    const sx = x - x0;
    const sy = y - y0;

    const g00 = gradient(x0, y0, seed);
    const g10 = gradient(x1, y0, seed);
    const g01 = gradient(x0, y1, seed);
    const g11 = gradient(x1, y1, seed);

    const n00 = g00.x * (x - x0) + g00.y * (y - y0);
    const n10 = g10.x * (x - x1) + g10.y * (y - y0);
    const n01 = g01.x * (x - x0) + g01.y * (y - y1);
    const n11 = g11.x * (x - x1) + g11.y * (y - y1);

    const ix0 = lerp(n00, n10, fade(sx));
    const ix1 = lerp(n01, n11, fade(sx));
    return lerp(ix0, ix1, fade(sy));
  };

  const fbmPerlin = (x: number, y: number, seed: number): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let max = 0;

    for (let i = 0; i < NOISE_OCTAVES; i += 1) {
      value += perlin2(x * frequency, y * frequency, seed + i * 1013) * amplitude;
      max += amplitude;
      amplitude *= NOISE_PERSISTENCE;
      frequency *= NOISE_LACUNARITY;
    }

    const normalized = value / max;
    return (normalized + 1) * 0.5;
  };

  const refreshTilemap = (): void => {
    if (selectedTiles.length === 0) return;
    const weights: number[] = new Array(selectedTiles.length);
    let totalWeight = 0;
    for (let i = 0; i < selectedTiles.length; i += 1) {
      const weight = Math.pow(TILE_WEIGHT_DECAY, i);
      weights[i] = weight;
      totalWeight += weight;
    }

    let index = 0;
    for (let row = 0; row < mapRows; row += 1) {
      for (let col = 0; col < mapColumns; col += 1) {
        const density = fbmPerlin(col * NOISE_SCALE, row * NOISE_SCALE, noiseSeed);
        const sprite = mapSprites[index];

        if (density < 1 - NOISE_COVERAGE) {
          sprite.visible = false;
          index += 1;
          continue;
        }

        const selectionNoise = fbmPerlin(
          col * NOISE_SCALE + 101.3,
          row * NOISE_SCALE + 17.7,
          noiseSeed + 911
        );
        const clampedSelection = Math.min(0.999999, Math.max(0, selectionNoise));
        let roll = clampedSelection * totalWeight;
        let pick = 0;
        for (let i = 0; i < weights.length; i += 1) {
          roll -= weights[i];
          if (roll <= 0) {
            pick = i;
            break;
          }
        }
        const tileIndex = selectedTiles[pick]!;
        if (tileIndex === NONE_TILE_INDEX) {
          sprite.visible = false;
        } else {
          sprite.visible = true;
          sprite.texture = tileTextures[tileIndex];
        }
        index += 1;
      }
    }
  };

  const formatTileList = (tiles: number[]): string => {
    const MAX_SHOWN = 12;
    const format = (tile: number): string => (tile === NONE_TILE_INDEX ? "none" : String(tile));
    if (tiles.length <= MAX_SHOWN) {
      return tiles.map(format).join(", ");
    }
    return `${tiles.slice(0, MAX_SHOWN).map(format).join(", ")}, +${tiles.length - MAX_SHOWN}`;
  };

  const logTileSelection = (tileIndex: number): void => {
    if (!isDev) return;
    if (tileIndex === NONE_TILE_INDEX) {
      console.log("Selected tile: none");
      return;
    }
    const col = tileIndex % tileColumns;
    const row = Math.floor(tileIndex / tileColumns);
    console.log(`Selected tile: ${tileIndex} (col ${col}, row ${row})`);
  };

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
    text: isDev
      ? "WASD/Arrows: Move | Hold Mouse: Charge | Release: Throw | T: Tilesheet | [ / ]: Tile | Shift: Palette | N: None | R: Reroll"
      : "WASD/Arrows: Move | Hold Mouse: Charge | Release: Throw",
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

  let debugOverlay: Container | null = null;
  let sheetSprite: PixiSprite | null = null;
  let highlight: Graphics | null = null;
  let debugText: Text | null = null;
  let debugScale = 1;

  if (isDev) {
    debugOverlay = new Container();
    debugOverlay.x = 10;
    debugOverlay.y = 40;

    sheetSprite = new PixiSprite(grassSheet);
    debugScale = Math.min(
      DEBUG_SHEET_MAX_SCALE,
      (WIDTH - 20) / grassSheet.width,
      (HEIGHT - 120) / grassSheet.height
    );
    sheetSprite.scale.set(debugScale);

    const debugBackground = new Graphics();
    debugBackground.rect(0, 0, sheetSprite.width, sheetSprite.height);
    debugBackground.fill({ color: 0x000000, alpha: 0.35 });

    highlight = new Graphics();

    debugText = new Text({
      text: "",
      style: { fontSize: 12, fill: 0xffffff },
    });
    debugText.x = 6;
    debugText.y = sheetSprite.height + 6;

    debugOverlay.addChild(debugBackground);
    debugOverlay.addChild(sheetSprite);
    debugOverlay.addChild(highlight);
    debugOverlay.addChild(debugText);
    app.stage.addChild(debugOverlay);
  }

  const updateDebugOverlay = (): void => {
    if (!debugOverlay || !sheetSprite || !highlight || !debugText) return;
    const tileSizeScaled = TILE_SIZE * debugScale;

    highlight.clear();
    if (selectedTile !== NONE_TILE_INDEX) {
      const col = selectedTile % tileColumns;
      const row = Math.floor(selectedTile / tileColumns);
      highlight.rect(col * tileSizeScaled, row * tileSizeScaled, tileSizeScaled, tileSizeScaled);
      highlight.stroke({ width: 2, color: 0xffd24a, alpha: 0.9 });
    }

    const tileLabel = selectedTile === NONE_TILE_INDEX
      ? "none"
      : `${selectedTile} (col ${selectedTile % tileColumns}, row ${Math.floor(selectedTile / tileColumns)})`;
    debugText.text = `Tile: ${tileLabel}\n` +
      `Palette: [${formatTileList(selectedTiles)}] | Seed: ${noiseSeed}\n` +
      `Scale: ${NOISE_SCALE} | Coverage: ${NOISE_COVERAGE} | Decay: ${TILE_WEIGHT_DECAY}`;
  };

  const setSelectedTile = (nextTile: number, togglePalette: boolean): void => {
    if (tileCount === 0) return;
    const wrapped = wrapTileIndex(nextTile);
    if (wrapped === selectedTile && !togglePalette) return;
    selectedTile = wrapped;
    if (togglePalette) {
      const existingIndex = selectedTiles.indexOf(selectedTile);
      if (existingIndex >= 0) {
        selectedTiles.splice(existingIndex, 1);
      } else {
        selectedTiles = [...selectedTiles, selectedTile];
      }
      if (selectedTiles.length === 0) {
        selectedTiles = [selectedTile];
      }
    } else {
      selectedTiles = [selectedTile];
    }
    logTileSelection(selectedTile);
    refreshTilemap();
    updateDebugOverlay();
  };

  updateDebugOverlay();
  refreshTilemap();

  // Game loop
  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000; // Convert to seconds

    // Update input state
    updateInput();

    if (isDev) {
      const input = getInput();
      const shiftHeld = input.keys.has("ShiftLeft") || input.keys.has("ShiftRight");

      if (isKeyPressed("KeyT") && debugOverlay) {
        debugOverlay.visible = !debugOverlay.visible;
      }
      if (isKeyPressed("KeyR")) {
        noiseSeed = (noiseSeed + 1) >>> 0;
        refreshTilemap();
        updateDebugOverlay();
      }
      if (isKeyPressed("KeyN")) {
        setSelectedTile(NONE_TILE_INDEX, shiftHeld);
      }
      if (isKeyPressed("BracketRight")) {
        setSelectedTile(selectedTile + 1, shiftHeld);
      }
      if (isKeyPressed("BracketLeft")) {
        setSelectedTile(selectedTile - 1, shiftHeld);
      }

      if (debugOverlay && debugOverlay.visible && sheetSprite && input.mousePressed) {
        const localX = input.mouseX - debugOverlay.x;
        const localY = input.mouseY - debugOverlay.y;
        if (localX >= 0 && localY >= 0 && localX < sheetSprite.width && localY < sheetSprite.height) {
          const tileSizeScaled = TILE_SIZE * debugScale;
          const col = Math.floor(localX / tileSizeScaled);
          const row = Math.floor(localY / tileSizeScaled);
          const index = row * tileColumns + col;
          if (index >= 0 && index < tileCount) {
            setSelectedTile(index, shiftHeld);
          }
        }
      }
    }

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
