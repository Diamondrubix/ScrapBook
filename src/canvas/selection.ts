import type { Item } from "../lib/types";
import type { Point } from "./types";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function itemBounds(item: Item): Bounds {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  };
}

export function rectFromPoints(start: Point, current: Point): Bounds {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return { x, y, width, height };
}

export function getBoundsForItems(items: Item[]): Bounds | null {
  if (items.length === 0) return null;
  let minX = items[0].x;
  let minY = items[0].y;
  let maxX = items[0].x + items[0].width;
  let maxY = items[0].y + items[0].height;

  items.forEach((item) => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function rectsIntersect(a: Bounds, b: Bounds) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
