import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { throttle } from "../utils/throttle";

export type PresenceUser = {
  user_id: string;
  display_name: string;
  color: string;
  cursor: { x: number; y: number };
};

const COLORS = ["#e63946", "#2a9d8f", "#457b9d", "#f4a261", "#6d6875", "#1d3557"];

function pickColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % COLORS.length;
  }
  return COLORS[hash];
}

export function usePresence(boardId: string, user: User) {
  const [others, setOthers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const basePayload = useMemo(() => {
    return {
      user_id: user.id,
      display_name: user.email ?? "Guest",
      color: pickColor(user.id),
      cursor: { x: 0, y: 0 },
    };
  }, [user.id, user.email]);

  useEffect(() => {
    const channel = supabase.channel(`presence:${boardId}`, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const next: PresenceUser[] = [];
      Object.values(state).forEach((entries) => {
        const entry = (entries as PresenceUser[])[0];
        if (entry && entry.user_id !== user.id) next.push(entry);
      });
      setOthers(next);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(basePayload);
      }
    });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, basePayload, user.id]);

  const updateCursor = useMemo(() => {
    return throttle((cursor: { x: number; y: number }) => {
      channelRef.current?.track({ ...basePayload, cursor });
    }, 40);
  }, [basePayload]);

  return { others, updateCursor, selfColor: basePayload.color };
}
