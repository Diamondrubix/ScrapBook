import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { Item } from "../lib/types";
import type { PresenceUser } from "../hooks/usePresence";
import { throttle } from "../utils/throttle";
import { PresenceLayer } from "./PresenceLayer";
import { CanvasItem } from "../canvas/CanvasItem";
import type { DragHandle, ToolId, ViewState } from "../canvas/types";
import { MAX_SCALE, MIN_SCALE } from "../canvas/constants";
import { SelectTool } from "../canvas/tools/SelectTool";
import { ShapeTool } from "../canvas/tools/ShapeTool";
import { PenTool } from "../canvas/tools/PenTool";
import type { ToolContext } from "../canvas/tools/ToolContext";

type BoardCanvasProps = {
  items: Item[];
  presence: PresenceUser[];
  selectedIds: string[];
  onSelectIds: (itemIds: string[]) => void;
  onUpdateItem: (itemId: string, patch: Partial<Item>) => Promise<void> | void;
  onDeleteItem: (itemId: string) => Promise<void> | void;
  isLockedByOther: (itemId: string) => boolean;
  onCursorMove: (pos: { x: number; y: number }) => void;
  tool: ToolId;
  drawColor: string;
  onToolChange: (tool: ToolId) => void;
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
  readOnly?: boolean;
};

export function BoardCanvas({
  items,
  presence,
  selectedIds,
  onSelectIds,
  onUpdateItem,
  onDeleteItem,
  isLockedByOther,
  onCursorMove,
  tool,
  drawColor,
  onToolChange,
  onCreateShape,
  onCreateDraw,
  readOnly = false,
}: BoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewState>({ x: 100, y: 80, scale: 1 });
  const [, forceRender] = useReducer((value) => value + 1, 0);
  const panRef = useRef<{ startClient: { x: number; y: number }; startView: ViewState } | null>(
    null,
  );

  // Tool instances persist across renders to keep in-progress state.
  const toolsRef = useRef({
    select: new SelectTool(),
    rect: new ShapeTool("rect"),
    circle: new ShapeTool("circle"),
    arrow: new ShapeTool("arrow"),
    pen: new PenTool(),
  });

  useEffect(() => {
    // Clear any in-progress drag/draw when switching tools.
    toolsRef.current[tool].reset();
  }, [tool]);

  // Convert from client pixels into world coordinates (items are stored in world space).
  const toWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  };

  // Throttle writes to reduce DB chatter while dragging.
  const updateItemThrottled = useMemo(
    () =>
      throttle((itemId: string, patch: Partial<Item>) => {
        void onUpdateItem(itemId, patch);
      }, 40),
    [onUpdateItem],
  );

  // ToolContext is the contract between the canvas shell and tool classes.
  const context: ToolContext = {
    getView: () => view,
    setView,
    toWorld,
    invalidate: () => forceRender(),
    getItems: () => items,
    getSelectedIds: () => selectedIds,
    setSelectedIds: onSelectIds,
    isLockedByOther,
    updateItem: onUpdateItem,
    updateItemThrottled,
    createShape: onCreateShape,
    createDraw: onCreateDraw,
    drawColor,
    requestToolChange: onToolChange,
  };

  const activeTool = toolsRef.current[tool];
  activeTool.setContext(context);

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
    if (readOnly) {
      // Public view: only allow right-click panning.
      if (event.button === 2) {
        panRef.current = {
          startClient: { x: event.clientX, y: event.clientY },
          startView: view,
        };
      }
      return;
    }
    const target = event.target as HTMLElement | null;
    const hitItem = target?.closest("[data-item-id]");
    // Selection uses item handlers; other tools draw even over existing items.
    if (tool === "select" && hitItem && event.button === 0) return;
    activeTool.onCanvasPointerDown(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (readOnly && panRef.current) {
      const dx = event.clientX - panRef.current.startClient.x;
      const dy = event.clientY - panRef.current.startClient.y;
      setView({
        x: panRef.current.startView.x + dx,
        y: panRef.current.startView.y + dy,
        scale: panRef.current.startView.scale,
      });
      return;
    }
    const world = toWorld(event.clientX, event.clientY);
    // Live cursor updates are in world space.
    onCursorMove(world);
    activeTool.onPointerMove(event);
  };

  const handlePointerUp = () => {
    if (readOnly) {
      panRef.current = null;
      return;
    }
    activeTool.onPointerUp();
  };

  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (selectedIds.length === 0) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      selectedIds.forEach((itemId) => {
        void onDeleteItem(itemId);
      });
      onSelectIds([]);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, onDeleteItem, onSelectIds]);

  const handleItemPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    item: Item,
    handle?: DragHandle,
  ) => {
    activeTool.onItemPointerDown(event, item, handle);
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
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="canvas-layer"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {items.map((item) => (
          <CanvasItem
            key={item.id}
            item={item}
            selected={selectedIds.includes(item.id)}
            showOutline={selectedIds.length <= 1}
            locked={isLockedByOther(item.id)}
            tool={tool}
            onPointerDown={handleItemPointerDown}
            onDelete={onDeleteItem}
            onUpdateItem={onUpdateItem}
          />
        ))}
        {/* Draft overlays (shape/pen) render above existing items. */}
        {activeTool.renderOverlay()}
        <PresenceLayer users={presence} />
      </div>
    </div>
  );
}
