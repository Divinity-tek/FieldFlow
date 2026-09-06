import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PinnedMessage {
  id: string;
  content: string;
  sender_id: string;
  pinned_by: string;
  pinned_at: string;
  created_at: string;
}

export function usePinnedMessages(roomId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const pinnedQuery = useQuery({
    queryKey: ["pinned-messages", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_room_messages")
        .select("id, content, sender_id, pinned_by, pinned_at, created_at")
        .eq("room_id", roomId!)
        .eq("is_pinned", true)
        .order("pinned_at", { ascending: false });
      if (error) throw error;
      return data as PinnedMessage[];
    },
    enabled: !!roomId && !!user,
  });

  const togglePin = useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const { error } = await supabase
        .from("chat_room_messages")
        .update({
          is_pinned: pinned,
          pinned_by: pinned ? user!.id : null,
          pinned_at: pinned ? new Date().toISOString() : null,
        })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pinned-messages", roomId] });
    },
  });

  return {
    pinnedMessages: pinnedQuery.data ?? [],
    isLoading: pinnedQuery.isLoading,
    togglePin,
  };
}
