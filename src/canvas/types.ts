export type ToolId = "select" | "rect" | "circle" | "arrow" | "pen";

export type ShapeKind = "rect" | "circle" | "arrow";

export type DragHandle = "nw" | "ne" | "sw" | "se";

export type Point = {
  x: number;
  y: number;
};

export type ViewState = {
  x: number;
  y: number;
  scale: number;
};
