import type { Item } from "../../lib/types";
import type { Point, ShapeKind, ViewState } from "../types";

export type ToolContext = {
  getView: () => ViewState;
  setView: (view: ViewState) => void;
  toWorld: (clientX: number, clientY: number) => Point;
  invalidate: () => void;
  selectItem: (itemId: string | null) => void;
  isLockedByOther: (itemId: string) => boolean;
  updateItem: (itemId: string, patch: Partial<Item>) => void;
  updateItemThrottled: (itemId: string, patch: Partial<Item>) => void;
  createShape: (args: {
    kind: ShapeKind;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }) => void;
  createDraw: (args: {
    points: Point[];
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  drawColor: string;
};
