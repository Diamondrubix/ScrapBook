import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { ItemLock } from "../lib/types";

export function useItemLocks(boardId: string, userId: string) {
  const [locks, setLocks] = useState<Record<string, ItemLock>>({});

  useEffect(() => {
    let mounted = true;

    const loadLocks = async () => {
      // Load existing locks for this board (joins items to filter by board_id).
      const { data, error } = await supabase
        .from("item_locks")
        .select("item_id,user_id,locked_at,expires_at,items!inner(board_id)")
        .eq("items.board_id", boardId);

      if (!mounted) return;
      if (error) return;
      const next: Record<string, ItemLock> = {};
      (data ?? []).forEach((row) => {
        const lock = row as ItemLock;
        next[lock.item_id] = lock;
      });
      setLocks(next);
    };

    void loadLocks();

    // Realtime updates for locks (currently not filtered by board_id).
    const channel = supabase
      .channel(`locks:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "item_locks" },
        (payload) => {
          setLocks((prev) => {
            const copy = { ...prev };
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const lock = payload.new as ItemLock;
              copy[lock.item_id] = lock;
              return copy;
            }
            if (payload.eventType === "DELETE") {
              const lock = payload.old as ItemLock;
              delete copy[lock.item_id];
              return copy;
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

  const lockItem = async (itemId: string) => {
    // MVP: locks do not expire; see TODO_WORKAROUNDS.md.
    const now = new Date().toISOString();
    await supabase.from("item_locks").upsert({
      item_id: itemId,
      user_id: userId,
      locked_at: now,
      expires_at: null,
    });
  };

  const unlockItem = async (itemId: string) => {
    await supabase.from("item_locks").delete().eq("item_id", itemId).eq("user_id", userId);
  };

  const isLockedByOther = (itemId: string) => {
    const lock = locks[itemId];
    return lock && lock.user_id !== userId;
  };

  return {
    locks,
    lockItem,
    unlockItem,
    isLockedByOther,
  };
}
