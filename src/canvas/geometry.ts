import type { Point } from "./types";

export function distance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getBounds(points: Point[]) {
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  points.forEach((pt) => {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  });

  return { minX, minY, maxX, maxY };
}

export function normalizePoints(points: Point[], offset: Point) {
  return points.map((pt) => ({ x: pt.x - offset.x, y: pt.y - offset.y }));
}
