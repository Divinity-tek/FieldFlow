import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TypingUser {
  userId: string;
  name: string;
}

export function useTypingIndicator(roomId: string | null) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`typing-${roomId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === user.id) return;

        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.userId === payload.userId);
          if (!exists) {
            return [...prev, { userId: payload.userId, name: payload.name }];
          }
          return prev;
        });

        // Clear existing timeout for this user
        const existing = timeoutsRef.current.get(payload.userId);
        if (existing) clearTimeout(existing);

        // Remove after 3 seconds of no typing
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
          timeoutsRef.current.delete(payload.userId);
        }, 3000);
        timeoutsRef.current.set(payload.userId, timeout);
      })
      .on("broadcast", { event: "stop_typing" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
        const existing = timeoutsRef.current.get(payload.userId);
        if (existing) {
          clearTimeout(existing);
          timeoutsRef.current.delete(payload.userId);
        }
      })
      .subscribe();

    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, user]);

  const sendTyping = useCallback(
    (name: string) => {
      if (!channelRef.current || !user) return;

      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, name },
      });

      // Auto-send stop after 2.5s of no calls
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.send({
          type: "broadcast",
          event: "stop_typing",
          payload: { userId: user.id },
        });
      }, 2500);
    },
    [user]
  );

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !user) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    channelRef.current.send({
      type: "broadcast",
      event: "stop_typing",
      payload: { userId: user.id },
    });
  }, [user]);

  return { typingUsers, sendTyping, stopTyping };
}
