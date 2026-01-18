import { query } from "bitecs";
import { Graphics, Container } from "pixi.js";
import { Position, Sprite } from "../components.ts";
import type { World } from "../types.ts";

// Graphics pool - reuse objects instead of creating/destroying
class GraphicsPool {
  private pool: Graphics[] = [];
  private active: number = 0;
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  // Get a graphics object from pool or create new one
  acquire(): Graphics {
    if (this.active < this.pool.length) {
      const g = this.pool[this.active]!;
      g.visible = true;
      this.active++;
      return g;
    }

    const g = new Graphics();
    this.pool.push(g);
    this.container.addChild(g);
    this.active++;
    return g;
  }

  // Reset pool for next frame - hide unused graphics
  reset(): void {
    for (let i = this.active; i < this.pool.length; i++) {
      this.pool[i]!.visible = false;
    }
    this.active = 0;
  }

  get size(): number {
    return this.pool.length;
  }

  get activeCount(): number {
    return this.active;
  }
}

// Render system state - lives outside the pure function
// In a larger game, this would be managed by a RenderContext
let pool: GraphicsPool | null = null;

export function initRenderSystem(container: Container): void {
  pool = new GraphicsPool(container);
}

// Pure-ish render system - queries ECS, syncs to Pixi
// This is the bridge between simulation (ECS) and presentation (Pixi)
export function renderSystem(world: World): void {
  if (!pool) {
    throw new Error("Render system not initialized. Call initRenderSystem first.");
  }

  // Reset pool - all graphics start as available
  pool.reset();

  // Query all renderable entities
  const entities = query(world, [Position, Sprite]);

  for (const eid of entities) {
    const g = pool.acquire();

    const x = Position.x[eid]!;
    const y = Position.y[eid]!;
    const color = Sprite.color[eid]!;
    const radius = Sprite.radius[eid]!;

    // Clear and redraw
    // Note: For better perf at scale, we'd cache and only redraw on change
    g.clear();
    g.circle(0, 0, radius);
    g.fill(color);
    g.x = x;
    g.y = y;
  }
}

// Debug info
export function getRenderStats(): { poolSize: number; active: number } {
  return {
    poolSize: pool?.size ?? 0,
    active: pool?.activeCount ?? 0,
  };
}
