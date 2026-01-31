import type { ReactNode } from "react";
import type { PointerEvent } from "react";
import { PEN_POINT_MIN_DISTANCE } from "../constants";
import { distance, getBounds, normalizePoints } from "../geometry";
import { renderDraw } from "../renderers";
import type { Point } from "../types";
import { BaseTool } from "./BaseTool";

// Freehand pen tool that records points and converts them to a draw item.
export class PenTool extends BaseTool {
  private points: Point[] | null = null;

  reset() {
    this.points = null;
  }

  onCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const world = this.ctx.toWorld(event.clientX, event.clientY);
    this.points = [world];
    this.ctx.invalidate();
  }

  onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!this.points) return;
    const world = this.ctx.toWorld(event.clientX, event.clientY);
    const last = this.points[this.points.length - 1];
    if (distance(world, last) >= PEN_POINT_MIN_DISTANCE) {
      this.points = [...this.points, world];
      this.ctx.invalidate();
    }
  }

  onPointerUp() {
    if (!this.points || this.points.length < 2) {
      this.points = null;
      this.ctx.invalidate();
      return;
    }

    const bounds = getBounds(this.points);
    const width = Math.max(2, bounds.maxX - bounds.minX);
    const height = Math.max(2, bounds.maxY - bounds.minY);
    const normalized = normalizePoints(this.points, { x: bounds.minX, y: bounds.minY });

    this.ctx.createDraw({
      points: normalized,
      x: bounds.minX,
      y: bounds.minY,
      width,
      height,
    });

    this.points = null;
    this.ctx.invalidate();
  }

  renderOverlay(): ReactNode {
    if (!this.points || this.points.length < 2) return null;
    const bounds = getBounds(this.points);
    const width = Math.max(2, bounds.maxX - bounds.minX);
    const height = Math.max(2, bounds.maxY - bounds.minY);
    const normalized = normalizePoints(this.points, { x: bounds.minX, y: bounds.minY });
    return (
      <div
        className="item selected"
        style={{
          width,
          height,
          transform: `translate(${bounds.minX}px, ${bounds.minY}px)`,
          transformOrigin: "center center",
          pointerEvents: "none",
        }}
      >
        {renderDraw(normalized, width, height, this.ctx.drawColor, 2)}
      </div>
    );
  }
}
