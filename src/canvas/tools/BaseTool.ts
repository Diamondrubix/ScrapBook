import type { ReactNode } from "react";
import type { PointerEvent } from "react";
import type { Item } from "../../lib/types";
import type { DragHandle } from "../types";
import type { ToolContext } from "./ToolContext";

export abstract class BaseTool {
  protected ctx!: ToolContext;

  setContext(ctx: ToolContext) {
    this.ctx = ctx;
  }

  reset() {}

  onCanvasPointerDown(_event: PointerEvent<HTMLDivElement>) {}

  onItemPointerDown(
    _event: PointerEvent<HTMLDivElement>,
    _item: Item,
    _handle?: DragHandle,
  ) {}

  onPointerMove(_event: PointerEvent<HTMLDivElement>) {}

  onPointerUp() {}

  renderOverlay(): ReactNode {
    return null;
  }
}
