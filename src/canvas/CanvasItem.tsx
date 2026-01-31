import type { PointerEvent } from "react";
import type { Item } from "../lib/types";
import type { DragHandle, ToolId } from "./types";
import { renderDraw, renderShape } from "./renderers";

type CanvasItemProps = {
  item: Item;
  selected: boolean;
  locked: boolean;
  tool: ToolId;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, item: Item, handle?: DragHandle) => void;
  onDelete: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<Item>) => void;
};

export function CanvasItem({
  item,
  selected,
  locked,
  tool,
  onPointerDown,
  onDelete,
  onUpdateItem,
}: CanvasItemProps) {
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (tool !== "select") return;
    event.stopPropagation();
    const handle = (event.target as HTMLElement).dataset.handle as DragHandle | undefined;
    onPointerDown(event, item, handle);
  };

  return (
    <div
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
      onPointerDown={handlePointerDown}
      onDoubleClick={() => {
        if (selected && !locked) onDelete(item.id);
      }}
    >
      <CanvasItemContent item={item} onUpdateItem={onUpdateItem} />
      {selected && tool === "select" && !locked && (
        <>
          {/* Corner handles for resize */}
          <div className="resize-handle handle-nw" data-handle="nw" />
          <div className="resize-handle handle-ne" data-handle="ne" />
          <div className="resize-handle handle-sw" data-handle="sw" />
          <div className="resize-handle handle-se" data-handle="se" />
        </>
      )}
    </div>
  );
}

type CanvasItemContentProps = {
  item: Item;
  onUpdateItem: (itemId: string, patch: Partial<Item>) => void;
};

function CanvasItemContent({ item, onUpdateItem }: CanvasItemContentProps) {
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
            onUpdateItem(item.id, { data: { ...item.data, text: next } });
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
      return renderShape(kind as "rect" | "circle" | "arrow", color);
    }
    case "draw": {
      const points = (item.data.points as { x: number; y: number }[]) ?? [];
      const color = (item.data.color as string) ?? "#111";
      const strokeWidth = (item.data.strokeWidth as number) ?? 2;
      return renderDraw(points, item.width, item.height, color, strokeWidth);
    }
    default:
      return <div style={{ width: "100%", height: "100%" }} />;
  }
}
