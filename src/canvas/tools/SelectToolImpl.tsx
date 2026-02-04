import type { PointerEvent } from "react";
import type { Item } from "../../lib/types";
import { MIN_RESIZE_SIZE } from "../constants";
import { getBoundsForItems, itemBounds, rectFromPoints, rectsIntersect } from "../selection";
import type { Bounds } from "../selection";
import type { DragHandle, Point, ViewState } from "../types";
import { BaseTool } from "./BaseTool";

type ItemOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type DragState =
  | {
      mode: "pan";
      startClient: Point;
      startView: ViewState;
    }
  | {
      mode: "move" | "resize" | "rotate";
      itemIds: string[];
      startWorld: Point;
      originBounds: Bounds;
      origins: Map<string, ItemOrigin>;
      handle?: DragHandle;
      startAngle?: number;
    };

type SelectionBox = {
  start: Point;
  current: Point;
};

// Handles selection, move/resize/rotate, and panning on empty canvas.
export class SelectTool extends BaseTool {
  private drag: DragState | null = null;
  private selectionBox: SelectionBox | null = null;

  reset() {
    this.drag = null;
    this.selectionBox = null;
  }

  onCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    const world = this.ctx.toWorld(event.clientX, event.clientY);
    if (event.button === 2) {
      // Right-click drag pans the canvas.
      this.drag = {
        mode: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        startView: this.ctx.getView(),
      };
      return;
    }

    if (event.button !== 0) return;
    // Left-drag on empty canvas begins a selection box.
    this.selectionBox = { start: world, current: world };
    this.ctx.invalidate();
  }

  onItemPointerDown(event: PointerEvent<HTMLDivElement>, item: Item, handle?: DragHandle) {
    if (event.button !== 0) return;
    if (this.ctx.isLockedByOther(item.id)) return;

    const currentSelection = this.ctx.getSelectedIds();
    const selection = currentSelection.includes(item.id) ? currentSelection : [item.id];
    this.ctx.setSelectedIds(selection);

    const world = this.ctx.toWorld(event.clientX, event.clientY);
    const originBounds = getBoundsForItems(
      this.ctx.getItems().filter((candidate) => selection.includes(candidate.id)),
    );
    if (!originBounds) return;

    const mode =
      handle && selection.length > 0
        ? "resize"
        : event.altKey && selection.length === 1
          ? "rotate"
          : "move";

    const origins = new Map<string, ItemOrigin>();
    this.ctx.getItems().forEach((candidate) => {
      if (selection.includes(candidate.id)) {
        origins.set(candidate.id, {
          x: candidate.x,
          y: candidate.y,
          width: candidate.width,
          height: candidate.height,
          rotation: candidate.rotation,
        });
      }
    });

    this.drag = {
      mode,
      itemIds: selection,
      startWorld: world,
      originBounds,
      origins,
      handle,
    };
    this.ctx.setDraggingIds(selection);

    // Alt + drag on a single item rotates around its center.
    if (mode === "rotate" && selection.length === 1) {
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      this.drag.startAngle =
        Math.atan2(world.y - centerY, world.x - centerX) * (180 / Math.PI);
    }
  }

  onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const world = this.ctx.toWorld(event.clientX, event.clientY);

    if (this.selectionBox) {
      this.selectionBox.current = world;
      this.ctx.invalidate();
      return;
    }

    if (!this.drag) return;

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
      const dx = world.x - this.drag.startWorld.x;
      const dy = world.y - this.drag.startWorld.y;
      this.drag.itemIds.forEach((itemId) => {
        const origin = this.drag?.origins.get(itemId);
        if (!origin) return;
        // Apply the delta relative to each item's original position.
        const patch = { x: origin.x + dx, y: origin.y + dy };
        this.ctx.updateItemLocal(itemId, patch);
        this.ctx.updateItemRemoteThrottled(itemId, patch);
      });
      return;
    }

    if (this.drag.mode === "resize") {
      // Resize uses the group bounding box and scales each item proportionally.
      const dx = world.x - this.drag.startWorld.x;
      const dy = world.y - this.drag.startWorld.y;
      let nextX = this.drag.originBounds.x;
      let nextY = this.drag.originBounds.y;
      let nextW = this.drag.originBounds.width;
      let nextH = this.drag.originBounds.height;

      switch (this.drag.handle) {
        case "nw":
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.width - dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.height - dy);
          nextX = this.drag.originBounds.x + (this.drag.originBounds.width - nextW);
          nextY = this.drag.originBounds.y + (this.drag.originBounds.height - nextH);
          break;
        case "ne":
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.width + dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.height - dy);
          nextY = this.drag.originBounds.y + (this.drag.originBounds.height - nextH);
          break;
        case "sw":
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.width - dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.height + dy);
          nextX = this.drag.originBounds.x + (this.drag.originBounds.width - nextW);
          break;
        case "se":
        default:
          nextW = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.width + dx);
          nextH = Math.max(MIN_RESIZE_SIZE, this.drag.originBounds.height + dy);
          break;
      }

      const scaleX = nextW / this.drag.originBounds.width;
      const scaleY = nextH / this.drag.originBounds.height;

      this.drag.itemIds.forEach((itemId) => {
        const origin = this.drag?.origins.get(itemId);
        if (!origin) return;
        const relX = origin.x - this.drag.originBounds.x;
        const relY = origin.y - this.drag.originBounds.y;
        const patch = {
          x: nextX + relX * scaleX,
          y: nextY + relY * scaleY,
          width: origin.width * scaleX,
          height: origin.height * scaleY,
        };
        this.ctx.updateItemLocal(itemId, patch);
        this.ctx.updateItemRemoteThrottled(itemId, patch);
      });
      return;
    }

    if (this.drag.mode === "rotate") {
      const centerX = this.drag.originBounds.x + this.drag.originBounds.width / 2;
      const centerY = this.drag.originBounds.y + this.drag.originBounds.height / 2;
      const angle = Math.atan2(world.y - centerY, world.x - centerX) * (180 / Math.PI);
      const delta = angle - (this.drag.startAngle ?? 0);
      const itemId = this.drag.itemIds[0];
      const origin = this.drag.origins.get(itemId);
      if (!origin) return;
      const patch = { rotation: origin.rotation + delta };
      this.ctx.updateItemLocal(itemId, patch);
      this.ctx.updateItemRemoteThrottled(itemId, patch);
    }
  }

  onPointerUp() {
    if (this.selectionBox) {
      const { start, current } = this.selectionBox;
      const rect = rectFromPoints(start, current);
      const hits = this.ctx
        .getItems()
        .filter((candidate) => rectsIntersect(rect, itemBounds(candidate)))
        .map((candidate) => candidate.id)
        .filter((id) => !this.ctx.isLockedByOther(id));

      // Replace selection with whatever the box intersects.
      this.ctx.setSelectedIds(hits);
      this.selectionBox = null;
      this.ctx.invalidate();
      return;
    }

    if (this.drag && this.drag.mode !== "pan") {
      const items = this.ctx.getItems();
      this.drag.itemIds.forEach((itemId) => {
        const item = items.find((entry) => entry.id === itemId);
        if (!item) return;
        this.ctx.updateItemRemote(itemId, {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          rotation: item.rotation,
        });
      });
      this.ctx.setDraggingIds([]);
    }

    this.drag = null;
  }

  renderOverlay() {
    const overlays = [];
    if (this.selectionBox) {
      const rect = rectFromPoints(this.selectionBox.start, this.selectionBox.current);
      overlays.push(
        <div
          key="selection-box"
          className="selection-box"
          style={{
            width: rect.width,
            height: rect.height,
            transform: `translate(${rect.x}px, ${rect.y}px)`,
          }}
        />,
      );
    }

    const selection = this.ctx.getSelectedIds();
    // If multiple items are selected, render a single group box with resize handles.
    if (selection.length > 1) {
      const selectedItems = this.ctx.getItems().filter((item) => selection.includes(item.id));
      const bounds = getBoundsForItems(selectedItems);
      if (bounds) {
        overlays.push(
          <div
            key="group-box"
            className="selection-group"
            style={{
              width: bounds.width,
              height: bounds.height,
              transform: `translate(${bounds.x}px, ${bounds.y}px)`,
            }}
            onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              const world = this.ctx.toWorld(event.clientX, event.clientY);
              const origins = new Map<string, ItemOrigin>();
              selectedItems.forEach((item) => {
                origins.set(item.id, {
                  x: item.x,
                  y: item.y,
                  width: item.width,
                  height: item.height,
                  rotation: item.rotation,
                });
              });
              this.drag = {
                mode: "move",
                itemIds: selection,
                startWorld: world,
                originBounds: bounds,
                origins,
              };
              this.ctx.setDraggingIds(selection);
            }}
          >
            <div className="resize-handle handle-nw" data-handle="nw" onPointerDown={(event) => this.startGroupResize(event, "nw", bounds, selectedItems)} />
            <div className="resize-handle handle-ne" data-handle="ne" onPointerDown={(event) => this.startGroupResize(event, "ne", bounds, selectedItems)} />
            <div className="resize-handle handle-sw" data-handle="sw" onPointerDown={(event) => this.startGroupResize(event, "sw", bounds, selectedItems)} />
            <div className="resize-handle handle-se" data-handle="se" onPointerDown={(event) => this.startGroupResize(event, "se", bounds, selectedItems)} />
          </div>,
        );
      }
    }

    if (overlays.length === 0) return null;
    return <>{overlays}</>;
  }

  private startGroupResize(
    event: PointerEvent<HTMLDivElement>,
    handle: DragHandle,
    bounds: Bounds,
    selectedItems: Item[],
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const world = this.ctx.toWorld(event.clientX, event.clientY);
    const origins = new Map<string, ItemOrigin>();
    selectedItems.forEach((item) => {
      origins.set(item.id, {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
      });
    });

    this.drag = {
      mode: "resize",
      itemIds: selectedItems.map((item) => item.id),
      startWorld: world,
      originBounds: bounds,
      origins,
      handle,
    };
    this.ctx.setDraggingIds(selectedItems.map((item) => item.id));
  }
}
