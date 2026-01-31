import { useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { Item } from "../lib/types";
import type { PresenceUser } from "../hooks/usePresence";
import { throttle } from "../utils/throttle";
import { PresenceLayer } from "./PresenceLayer";

type BoardCanvasProps = {
  items: Item[];
  presence: PresenceUser[];
  selectedId: string | null;
  onSelect: (itemId: string | null) => void;
  onUpdateItem: (itemId: string, patch: Partial<Item>) => Promise<void> | void;
  onDeleteItem: (itemId: string) => Promise<void> | void;
  isLockedByOther: (itemId: string) => boolean;
  onCursorMove: (pos: { x: number; y: number }) => void;
  tool: "select" | "rect" | "circle" | "arrow" | "pen";
  drawColor: string;
  onCreateShape: (args: {
    kind: "rect" | "circle" | "arrow";
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }) => void;
  onCreateDraw: (args: {
    points: { x: number; y: number }[];
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
};

type ViewState = {
  x: number;
  y: number;
  scale: number;
};

type DragState =
  | {
      mode: "pan";
      startClient: { x: number; y: number };
      startView: ViewState;
    }
  | {
      mode: "move" | "resize" | "rotate";
      itemId: string;
      startWorld: { x: number; y: number };
      origin: { x: number; y: number; width: number; height: number; rotation: number };
      handle?: "nw" | "ne" | "sw" | "se";
      startAngle?: number;
    };

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const MIN_SIZE = 8;
const ARROW_HEIGHT = 20;

export function BoardCanvas({
  items,
  presence,
  selectedId,
  onSelect,
  onUpdateItem,
  onDeleteItem,
  isLockedByOther,
  onCursorMove,
  tool,
  drawColor,
  onCreateShape,
  onCreateDraw,
}: BoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [view, setView] = useState<ViewState>({ x: 100, y: 80, scale: 1 });
  const [drawState, setDrawState] = useState<{
    tool: "rect" | "circle" | "arrow";
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const [penState, setPenState] = useState<{
    points: { x: number; y: number }[];
  } | null>(null);

  const updateItemThrottled = useMemo(
    () =>
      throttle((itemId: string, patch: Partial<Item>) => {
        void onUpdateItem(itemId, patch);
      }, 40),
    [onUpdateItem],
  );

  const toWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (clientX - rect.left - view.x) / view.scale;
    const y = (clientY - rect.top - view.y) / view.scale;
    return { x, y };
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    const worldX = (cursorX - view.x) / view.scale;
    const worldY = (cursorY - view.y) / view.scale;
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, view.scale * (event.deltaY > 0 ? 0.9 : 1.1)),
    );
    const nextX = cursorX - worldX * nextScale;
    const nextY = cursorY - worldY * nextScale;
    setView({ x: nextX, y: nextY, scale: nextScale });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (
      tool === "select" &&
      event.target instanceof HTMLElement &&
      event.target.closest("[data-item-id]")
    ) {
      return;
    }
    const world = toWorld(event.clientX, event.clientY);
    if (tool === "pen") {
      setPenState({ points: [world] });
      return;
    }
    if (tool !== "select") {
      setDrawState({ tool, start: world, current: world });
      return;
    }
    onSelect(null);
    dragRef.current = {
      mode: "pan",
      startClient: { x: event.clientX, y: event.clientY },
      startView: view,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const world = toWorld(event.clientX, event.clientY);
    onCursorMove(world);

    const drag = dragRef.current;
    if (penState) {
      const last = penState.points[penState.points.length - 1];
      const dx = world.x - last.x;
      const dy = world.y - last.y;
      if (Math.hypot(dx, dy) > 1) {
        setPenState({ points: [...penState.points, world] });
      }
      return;
    }
    if (drawState) {
      setDrawState({ ...drawState, current: world });
      return;
    }
    if (!drag) return;

    if (drag.mode === "pan") {
      const dx = event.clientX - drag.startClient.x;
      const dy = event.clientY - drag.startClient.y;
      setView({ x: drag.startView.x + dx, y: drag.startView.y + dy, scale: drag.startView.scale });
      return;
    }

    if (drag.mode === "move") {
      const nextX = drag.origin.x + (world.x - drag.startWorld.x);
      const nextY = drag.origin.y + (world.y - drag.startWorld.y);
      updateItemThrottled(drag.itemId, { x: nextX, y: nextY });
      return;
    }

    if (drag.mode === "resize") {
      const dx = world.x - drag.startWorld.x;
      const dy = world.y - drag.startWorld.y;
      const min = 20;
      let nextX = drag.origin.x;
      let nextY = drag.origin.y;
      let nextW = drag.origin.width;
      let nextH = drag.origin.height;
      switch (drag.handle) {
        case "nw":
          nextW = Math.max(min, drag.origin.width - dx);
          nextH = Math.max(min, drag.origin.height - dy);
          nextX = drag.origin.x + (drag.origin.width - nextW);
          nextY = drag.origin.y + (drag.origin.height - nextH);
          break;
        case "ne":
          nextW = Math.max(min, drag.origin.width + dx);
          nextH = Math.max(min, drag.origin.height - dy);
          nextY = drag.origin.y + (drag.origin.height - nextH);
          break;
        case "sw":
          nextW = Math.max(min, drag.origin.width - dx);
          nextH = Math.max(min, drag.origin.height + dy);
          nextX = drag.origin.x + (drag.origin.width - nextW);
          break;
        case "se":
        default:
          nextW = Math.max(min, drag.origin.width + dx);
          nextH = Math.max(min, drag.origin.height + dy);
          break;
      }
      updateItemThrottled(drag.itemId, { x: nextX, y: nextY, width: nextW, height: nextH });
      return;
    }

    if (drag.mode === "rotate") {
      const centerX = drag.origin.x + drag.origin.width / 2;
      const centerY = drag.origin.y + drag.origin.height / 2;
      const angle = Math.atan2(world.y - centerY, world.x - centerX) * (180 / Math.PI);
      const delta = angle - (drag.startAngle ?? 0);
      updateItemThrottled(drag.itemId, { rotation: drag.origin.rotation + delta });
    }
  };

  const handlePointerUp = () => {
    if (penState) {
      const points = penState.points;
      if (points.length > 1) {
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
        const width = Math.max(2, maxX - minX);
        const height = Math.max(2, maxY - minY);
        const normalized = points.map((pt) => ({
          x: pt.x - minX,
          y: pt.y - minY,
        }));
        onCreateDraw({
          points: normalized,
          x: minX,
          y: minY,
          width,
          height,
        });
      }
      setPenState(null);
      dragRef.current = null;
      return;
    }
    if (drawState) {
      const { start, current } = drawState;
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      if (drawState.tool === "arrow") {
        const length = Math.hypot(dx, dy);
        if (length >= MIN_SIZE) {
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const cx = (start.x + current.x) / 2;
          const cy = (start.y + current.y) / 2;
          onCreateShape({
            kind: "arrow",
            x: cx - length / 2,
            y: cy - ARROW_HEIGHT / 2,
            width: length,
            height: ARROW_HEIGHT,
            rotation: angle,
          });
        }
      } else {
        const width = Math.abs(dx);
        const height = Math.abs(dy);
        if (width >= MIN_SIZE && height >= MIN_SIZE) {
          onCreateShape({
            kind: drawState.tool,
            x: dx < 0 ? current.x : start.x,
            y: dy < 0 ? current.y : start.y,
            width,
            height,
          });
        }
      }
      setDrawState(null);
    }
    dragRef.current = null;
  };

  const handleItemPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    item: Item,
  ) => {
    if (tool !== "select") return;
    event.stopPropagation();
    if (isLockedByOther(item.id)) return;
    const handle = (event.target as HTMLElement).dataset.handle as
      | "nw"
      | "ne"
      | "sw"
      | "se"
      | undefined;
    onSelect(item.id);

    const world = toWorld(event.clientX, event.clientY);
    const mode = handle ? "resize" : event.altKey ? "rotate" : event.shiftKey ? "resize" : "move";
    const drag: DragState = {
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
      drag.startAngle = Math.atan2(world.y - centerY, world.x - centerX) * (180 / Math.PI);
    }

    dragRef.current = drag;
  };

  const renderContent = (item: Item) => {
    switch (item.type) {
      case "text": {
        const text = (item.data.text as string) ?? "Double click to edit";
        return (
          <div
            contentEditable
            suppressContentEditableWarning
            style={{ width: "100%", height: "100%", outline: "none" }}
            onBlur={(event) => {
              const next = event.currentTarget.textContent ?? "";
              void onUpdateItem(item.id, { data: { ...item.data, text: next } });
            }}
          >
            {text}
          </div>
        );
      }
      case "image": {
        const url = item.data.url as string;
        return (
          <img
            src={url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
          />
        );
      }
      case "video_hosted": {
        const url = item.data.url as string;
        return <video src={url} controls style={{ width: "100%", height: "100%" }} />;
      }
      case "video_embed": {
        const url = item.data.url as string;
        return (
          <iframe
            src={url}
            title="Embedded video"
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="autoplay; encrypted-media"
          />
        );
      }
      case "link": {
        const url = item.data.url as string;
        return (
          <div>
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </div>
        );
      }
      case "shape": {
        const kind = (item.data.kind as string) ?? "rect";
        const color = (item.data.color as string) ?? "#111";
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
      case "draw": {
        const points = (item.data.points as { x: number; y: number }[]) ?? [];
        const color = (item.data.color as string) ?? "#111";
        const strokeWidth = (item.data.strokeWidth as number) ?? 2;
        const d = points
          .map((pt, index) => `${index === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
          .join(" ");
        return (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${item.width} ${item.height}`}
            preserveAspectRatio="none"
          >
            <path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      }
      default:
        return <div style={{ width: "100%", height: "100%" }} />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="board-canvas"
      onWheel={onWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="canvas-layer"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {drawState && (() => {
          const dx = drawState.current.x - drawState.start.x;
          const dy = drawState.current.y - drawState.start.y;
          if (drawState.tool === "arrow") {
            const length = Math.hypot(dx, dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const cx = (drawState.start.x + drawState.current.x) / 2;
            const cy = (drawState.start.y + drawState.current.y) / 2;
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
                {renderContent({
                  id: "draft",
                  board_id: "",
                  type: "shape",
                  data: { kind: "arrow", color: drawColor },
                  x: 0,
                  y: 0,
                  width: length,
                  height: ARROW_HEIGHT,
                  rotation: angle,
                  z_index: 0,
                  created_by: "",
                  created_at: "",
                  updated_at: "",
                })}
              </div>
            );
          }

          const width = Math.abs(dx);
          const height = Math.abs(dy);
          const x = dx < 0 ? drawState.current.x : drawState.start.x;
          const y = dy < 0 ? drawState.current.y : drawState.start.y;
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
              {renderContent({
                id: "draft",
                board_id: "",
                type: "shape",
                data: { kind: drawState.tool, color: drawColor },
                x: 0,
                y: 0,
                width,
                height,
                rotation: 0,
                z_index: 0,
                created_by: "",
                created_at: "",
                updated_at: "",
              })}
            </div>
          );
        })()}
        {penState && (() => {
          const points = penState.points;
          if (points.length < 2) return null;
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
          const width = Math.max(2, maxX - minX);
          const height = Math.max(2, maxY - minY);
          const normalized = points.map((pt) => ({ x: pt.x - minX, y: pt.y - minY }));
          const d = normalized
            .map((pt, index) => `${index === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
            .join(" ");
          return (
            <div
              className="item selected"
              style={{
                width,
                height,
                transform: `translate(${minX}px, ${minY}px)`,
                transformOrigin: "center center",
                pointerEvents: "none",
              }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
                <path
                  d={d}
                  stroke={drawColor}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        })()}
        {items.map((item) => {
          const locked = isLockedByOther(item.id);
          const selected = selectedId === item.id;
          return (
            <div
              key={item.id}
              className={`item ${selected ? "selected" : ""} ${locked ? "locked" : ""}`}
              data-item-id={item.id}
              style={{
                width: item.width,
                height: item.height,
                transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`,
                transformOrigin: "center center",
                background: item.type === "text" ? "#fffbe6" : "transparent",
                padding: item.type === "text" ? "8px" : "0",
              }}
              onPointerDown={(event) => handleItemPointerDown(event, item)}
              onDoubleClick={() => {
                if (selected && !locked) void onDeleteItem(item.id);
              }}
            >
              {renderContent(item)}
              {selected && tool === "select" && !locked && (
                <>
                  <div className="resize-handle handle-nw" data-handle="nw" />
                  <div className="resize-handle handle-ne" data-handle="ne" />
                  <div className="resize-handle handle-sw" data-handle="sw" />
                  <div className="resize-handle handle-se" data-handle="se" />
                </>
              )}
            </div>
          );
        })}
        <PresenceLayer users={presence} />
      </div>
    </div>
  );
}
