export type Board = {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  public_slug: string | null;
};

export type BoardMember = {
  board_id: string;
  user_id: string;
  role: "viewer" | "editor";
  invited_by: string;
  created_at: string;
};

export type ItemType =
  | "image"
  | "video_hosted"
  | "video_embed"
  | "text"
  | "link"
  | "shape"
  | "draw";

export type Item = {
  id: string;
  board_id: string;
  type: ItemType;
  data: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ItemLock = {
  item_id: string;
  user_id: string;
  locked_at: string;
  expires_at: string | null;
};
