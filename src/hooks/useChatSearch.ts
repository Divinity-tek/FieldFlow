import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SearchResult {
  id: string;
  content: string;
  sender_id: string;
  room_id: string;
  room_name: string;
  created_at: string;
  sender_name?: string;
}

export function useChatSearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const updateQuery = (val: string) => {
    setQuery(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    const t = setTimeout(() => setDebouncedQuery(val.trim()), 350);
    setDebounceTimer(t);
  };

  const searchResults = useQuery({
    queryKey: ["chat-message-search", debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      // Get rooms user is a member of
      const { data: memberRooms } = await supabase
        .from("chat_room_members")
        .select("room_id")
        .eq("user_id", user!.id);

      if (!memberRooms?.length) return [];
      const roomIds = memberRooms.map((r) => r.room_id);

      // Search messages
      const { data: msgs, error } = await supabase
        .from("chat_room_messages")
        .select("id, content, sender_id, room_id, created_at")
        .in("room_id", roomIds)
        .ilike("content", `%${debouncedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error || !msgs?.length) return [];

      // Fetch room names and sender profiles
      const uniqueRoomIds = [...new Set(msgs.map((m) => m.room_id))];
      const uniqueSenderIds = [...new Set(msgs.map((m) => m.sender_id))];

      const [{ data: rooms }, { data: profiles }] = await Promise.all([
        supabase.from("chat_rooms").select("id, name").in("id", uniqueRoomIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", uniqueSenderIds),
      ]);

      const roomMap = Object.fromEntries((rooms ?? []).map((r) => [r.id, r.name]));
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name]));

      return msgs.map((m) => ({
        ...m,
        room_name: roomMap[m.room_id] ?? "Unknown",
        sender_name: profileMap[m.sender_id] ?? "Unknown",
      }));
    },
    enabled: !!user && debouncedQuery.length >= 2,
  });

  return {
    query,
    setQuery: updateQuery,
    results: searchResults.data ?? [],
    isSearching: searchResults.isFetching,
  };
}
