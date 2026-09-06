import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export function useMessageReactions(roomId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const reactionsQuery = useQuery({
    queryKey: ["message-reactions", roomId],
    queryFn: async () => {
      const { data: messages } = await supabase
        .from("chat_room_messages")
        .select("id")
        .eq("room_id", roomId!);
      if (!messages?.length) return {};

      const messageIds = messages.map((m) => m.id);
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageIds);
      if (error) throw error;

      // Group by message_id -> emoji -> userIds
      const grouped: Record<string, Reaction[]> = {};
      for (const r of data ?? []) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        const existing = grouped[r.message_id].find((e) => e.emoji === r.emoji);
        if (existing) {
          existing.userIds.push(r.user_id);
        } else {
          grouped[r.message_id].push({ emoji: r.emoji, userIds: [r.user_id] });
        }
      }
      return grouped;
    },
    enabled: !!roomId && !!user,
  });

  // Realtime
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`reactions-${roomId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_reactions",
      }, () => {
        qc.invalidateQueries({ queryKey: ["message-reactions", roomId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, qc]);

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const reactions = reactionsQuery.data?.[messageId] ?? [];
      const existing = reactions.find((r) => r.emoji === emoji);
      const hasReacted = existing?.userIds.includes(user!.id);

      if (hasReacted) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user!.id)
          .eq("emoji", emoji);
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: user!.id,
          emoji,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-reactions", roomId] });
    },
  });

  return {
    reactions: reactionsQuery.data ?? {},
    toggleReaction,
  };
}
