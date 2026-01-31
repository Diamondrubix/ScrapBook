import type { PointerEvent } from "react";
import type { Item } from "../../lib/types";
import { MIN_RESIZE_SIZE } from "../constants";
import type { DragHandle, Point, ViewState } from "../types";
import { BaseTool } from "./BaseTool";

type DragState =
  | {
      mode: "pan";
      startClient: Point;
      startView: ViewState;
    }
  | {
      mode: "move" | "resize" | "rotate";
      itemId: string;
      startWorld: Point;
      origin: { x: number; y: number; width: number; height: number; rotation: number };
      handle?: DragHandle;
      startAngle?: number;
    };

// Handles selection, move/resize/rotate, and panning on empty canvas.
export class SelectTool extends BaseTool {
  private drag: DragState | null = null;

  reset() {
    this.drag = null;
  }

  onCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    this.ctx.selectItem(null);
    this.drag = {
      mode: "pan",
      startClient: { x: event.clientX, y: event.clientY },
      startView: this.ctx.getView(),
    };
  }

  onItemPointerDown(event: PointerEvent<HTMLDivElement>, item: Item, handle?: DragHandle) {
    if (event.button !== 0) return;
    if (this.ctx.isLockedByOther(item.id)) return;

    this.ctx.selectItem(item.id);
    const world = this.ctx.toWorld(event.clientX, event.clientY);
    const mode = handle
      ? "resize"
      : event.altKey
        ? "rotate"
        : event.shiftKey
          ? "resize"
          : "move";

    this.drag = {
      mode,
      itemId: item.id,
      startWorld: world,
      origin: {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
      },
      handle,
    };

    if (mode === "rotate") {
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      this.drag.startAngle =
        Math.atan2(world.y - centerY, world.x - centerX) * (180 / Math.PI);
    }
  }

  onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!this.drag) return;
    const world = this.ctx.toWorld(event.clientX, event.clientY);

    if (this.drag.mode === "pan") {
      const dx = event.clientX - this.drag.startClient.x;
      const dy = event.clientY - this.drag.startClient.y;
      this.ctx.setView({
        x: this.drag.startView.x + dx,
        y: this.drag.startView.y + dy,
        scale: this.drag.startView.scale,
      });
      return;
    }

    if (this.drag.mode === "move") {
      const nextX = this.drag.origin.x + (world.x - this.drag.startWorld.x);
      const nextY = this.drag.origin.y + (world.y - this.drag.startWorld.y);
      this.ctx.updateItemThrottled(this.drag.itemId, { x: nextX, y: nextY });
      return;
    }

    if (this.drag.mode === "resize") {
      const dx = world.x - this.drag.startWorld.x;
      const dy = world.y - this.drag.startWorld.y;
      let nextX = this.drag.origin.x;
      let nextY = this.drag.origin.y;
      let nextW = this.drag.origin.width;
      let nextH = this.drag.origin.height;

      switch (this.drag.handle) {
        case "nw":
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.origin.width - dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.origin.height - dy);
          nextX = this.drag.origin.x + (this.drag.origin.width - nextW);
          nextY = this.drag.origin.y + (this.drag.origin.height - nextH);
          break;
        case "ne":
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.origin.width + dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.origin.height - dy);
          nextY = this.drag.origin.y + (this.drag.origin.height - nextH);
          break;
        case "sw":
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.origin.width - dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.origin.height + dy);
          nextX = this.drag.origin.x + (this.drag.origin.width - nextW);
          break;
        case "se":
        default:
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.origin.width + dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.origin.height + dy);
          break;
      }

      this.ctx.updateItemThrottled(this.drag.itemId, {
        x: nextX,
        y: nextY,
        width: nextW,
        height: nextH,
      });
      return;
    }

    if (this.drag.mode === "rotate") {
      const centerX = this.drag.origin.x + this.drag.origin.width / 2;
      const centerY = this.drag.origin.y + this.drag.origin.height / 2;
      const angle = Math.atan2(world.y - centerY, world.x - centerX) * (180 / Math.PI);
      const delta = angle - (this.drag.startAngle ?? 0);
      this.ctx.updateItemThrottled(this.drag.itemId, {
        rotation: this.drag.origin.rotation + delta,
      });
    }
  }

  onPointerUp() {
    this.drag = null;
  }
}
