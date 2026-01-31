import type { ReactNode } from "react";
import type { Point, ShapeKind } from "./types";

export function buildPath(points: Point[]) {
  return points
    .map((pt, index) => `${index === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
    .join(" ");
}

export function renderShape(kind: ShapeKind, color: string): ReactNode {
  if (kind === "circle") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          border: `2px solid ${color}`,
        }}
      />
    );
  }

  if (kind === "arrow") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100">
        <line x1="10" y1="50" x2="85" y2="50" stroke={color} strokeWidth="6" />
        <polygon points="85,50 70,40 70,60" fill={color} />
      </svg>
    );
  }

  return <div style={{ width: "100%", height: "100%", border: `2px solid ${color}` }} />;
}

export function renderDraw(
  points: Point[],
  width: number,
  height: number,
  color: string,
  strokeWidth: number,
): ReactNode {
  if (points.length < 2) return null;
  const d = buildPath(points);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <path
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
