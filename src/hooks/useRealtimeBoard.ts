import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Item, ItemType } from "../lib/types";
import { makeId } from "../utils/ids";

type CreateItemArgs = {
  type: ItemType;
  data: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export function useRealtimeBoard(boardId: string, userId: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;
    let mounted = true;
    const load = async () => {
      // Initial snapshot for this board.
      const { data, error: loadError } = await supabase
        .from("items")
        .select("*")
        .eq("board_id", boardId);

      if (!mounted) return;
      if (loadError) {
        setError(loadError.message);
        return;
      }
      setItems((data ?? []) as Item[]);
    };
    void load();

    // Realtime: keep local state in sync with Postgres changes.
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `board_id=eq.${boardId}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              const next = payload.new as Item;
              if (prev.some((item) => item.id === next.id)) return prev;
              return [...prev, next];
            }
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Item;
              return prev.map((item) => (item.id === next.id ? next : item));
            }
            if (payload.eventType === "DELETE") {
              const removed = payload.old as Item;
              return prev.filter((item) => item.id !== removed.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  const createItem = async (args: CreateItemArgs) => {
    // Client-side item creation is optimistic for snappy UX.
    const now = new Date().toISOString();
    const maxZ = items.reduce((acc, item) => Math.max(acc, item.z_index), 0);
    const item: Item = {
      id: makeId(),
      board_id: boardId,
      type: args.type,
      data: args.data,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      rotation: args.rotation ?? 0,
      z_index: maxZ + 1,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };

    setItems((prev) => [...prev, item]);
    const { error: insertError } = await supabase.from("items").insert(item);
    if (insertError) setError(insertError.message);
  };

  const updateItem = async (itemId: string, patch: Partial<Item>) => {
    // Optimistically update local state; realtime will reconcile.
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
    const { error: updateError } = await supabase.from("items").update(patch).eq("id", itemId);
    if (updateError) setError(updateError.message);
  };

  const deleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    const { error: deleteError } = await supabase.from("items").delete().eq("id", itemId);
    if (deleteError) setError(deleteError.message);
  };

  const orderedItems = useMemo(
    () => [...items].sort((a, b) => a.z_index - b.z_index),
    [items],
  );

  return {
    items: orderedItems,
    createItem,
    updateItem,
    deleteItem,
    error,
  };
}
