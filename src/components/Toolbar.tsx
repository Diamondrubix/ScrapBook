import { useRef } from "react";
import type { ToolId } from "../canvas/types";

type ToolbarProps = {
  onAddText: () => void;
  onAddLink: (url: string) => void;
  onAddImage: (file: File) => void;
  onAddVideoEmbed: (url: string) => void;
  onAddVideoUpload: (file: File) => void;
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  color: string;
  onColorChange: (color: string) => void;
};

export function Toolbar({
  onAddText,
  onAddLink,
  onAddImage,
  onAddVideoEmbed,
  onAddVideoUpload,
  activeTool,
  onSelectTool,
  color,
  onColorChange,
}: ToolbarProps) {
  const imageRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);

  const pickImage = () => imageRef.current?.click();
  const pickVideo = () => videoRef.current?.click();

  return (
    <div className="toolbar">
      <button
        className={`button ${activeTool === "select" ? "active" : ""}`}
        onClick={() => onSelectTool("select")}
      >
        Select
      </button>
      <button className="button" onClick={onAddText}>
        Text
      </button>
      <button
        className="button"
        onClick={() => {
          const url = prompt("Paste a link");
          if (url) onAddLink(url);
        }}
      >
        Link
      </button>
      <button className="button" onClick={pickImage}>
        Image upload
      </button>
      <button
        className="button"
        onClick={() => {
          const url = prompt("Paste a video URL");
          if (url) onAddVideoEmbed(url);
        }}
      >
        Video embed
      </button>
      <button className="button" onClick={pickVideo}>
        Video upload
      </button>
      <button
        className={`button ${activeTool === "rect" ? "active" : ""}`}
        onClick={() => onSelectTool("rect")}
      >
        Rect
      </button>
      <button
        className={`button ${activeTool === "circle" ? "active" : ""}`}
        onClick={() => onSelectTool("circle")}
      >
        Circle
      </button>
      <button
        className={`button ${activeTool === "arrow" ? "active" : ""}`}
        onClick={() => onSelectTool("arrow")}
      >
        Arrow
      </button>
      <button
        className={`button ${activeTool === "pen" ? "active" : ""}`}
        onClick={() => onSelectTool("pen")}
      >
        Pen
      </button>
      <label className="row" style={{ alignItems: "center", gap: 6 }}>
        <span>Color</span>
        <input
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </label>

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onAddImage(file);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onAddVideoUpload(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
