import type { ReactNode } from "react";
import type { PointerEvent } from "react";
import { ARROW_HEIGHT, MIN_SHAPE_SIZE } from "../constants";
import { renderShape } from "../renderers";
import type { Point, ShapeKind } from "../types";
import { BaseTool } from "./BaseTool";

type DraftShape = {
  start: Point;
  current: Point;
};

// Drag-to-draw rectangles, circles, or arrows.
export class ShapeTool extends BaseTool {
  private kind: ShapeKind;
  private draft: DraftShape | null = null;

  constructor(kind: ShapeKind) {
    super();
    this.kind = kind;
  }

  reset() {
    this.draft = null;
  }

  onCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const world = this.ctx.toWorld(event.clientX, event.clientY);
    this.draft = { start: world, current: world };
    this.ctx.invalidate();
  }

  onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!this.draft) return;
    this.draft.current = this.ctx.toWorld(event.clientX, event.clientY);
    this.ctx.invalidate();
  }

  onPointerUp() {
    if (!this.draft) return;
    const { start, current } = this.draft;
    const dx = current.x - start.x;
    const dy = current.y - start.y;

    if (this.kind === "arrow") {
      const length = Math.hypot(dx, dy);
      if (length >= MIN_SHAPE_SIZE) {
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const cx = (start.x + current.x) / 2;
        const cy = (start.y + current.y) / 2;
        this.ctx.createShape({
          kind: "arrow",
          x: cx - length / 2,
          y: cy - ARROW_HEIGHT / 2,
          width: length,
          height: ARROW_HEIGHT,
          rotation: angle,
        });
      }
      this.draft = null;
      this.ctx.invalidate();
      return;
    }

    const width = Math.abs(dx);
    const height = Math.abs(dy);
    if (width >= MIN_SHAPE_SIZE && height >= MIN_SHAPE_SIZE) {
      this.ctx.createShape({
        kind: this.kind,
        x: dx < 0 ? current.x : start.x,
        y: dy < 0 ? current.y : start.y,
        width,
        height,
      });
    }

    this.draft = null;
    this.ctx.invalidate();
  }

  renderOverlay(): ReactNode {
    if (!this.draft) return null;
    const { start, current } = this.draft;
    const dx = current.x - start.x;
    const dy = current.y - start.y;

    if (this.kind === "arrow") {
      const length = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const cx = (start.x + current.x) / 2;
      const cy = (start.y + current.y) / 2;
      return (
        <div
          className="item selected"
          style={{
            width: length,
            height: ARROW_HEIGHT,
            transform: `translate(${cx - length / 2}px, ${cy - ARROW_HEIGHT / 2}px) rotate(${angle}deg)`,
            transformOrigin: "center center",
            pointerEvents: "none",
          }}
        >
          {renderShape("arrow", this.ctx.drawColor)}
        </div>
      );
    }

    const width = Math.abs(dx);
    const height = Math.abs(dy);
    const x = dx < 0 ? current.x : start.x;
    const y = dy < 0 ? current.y : start.y;

    return (
      <div
        className="item selected"
        style={{
          width,
          height,
          transform: `translate(${x}px, ${y}px)`,
          transformOrigin: "center center",
          pointerEvents: "none",
        }}
      >
        {renderShape(this.kind, this.ctx.drawColor)}
      </div>
    );
  }
}
