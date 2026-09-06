import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playNotificationSound } from "@/utils/notificationSound";
import { logAudit, logPolicyErrorIfAny } from "@/utils/auditLog";
import { toast } from "sonner";

export interface ChatRoom {
  id: string;
  name: string;
  type: "internal_team" | "job_specific" | "client_support" | "live_chat";
  job_id: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: any;
  created_at: string;
  sender_name?: string;
  reply_to_id?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean;
}

export interface ChatMember {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  last_read_at: string | null;
  joined_at: string;
  profile?: { full_name: string; email: string };
}

export function useChatRooms(type?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const roomsQuery = useQuery({
    queryKey: ["chat-rooms", type],
    queryFn: async () => {
      let q = supabase.from("chat_rooms").select("*").eq("status", "active").order("updated_at", { ascending: false });
      if (type) q = q.eq("type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data as ChatRoom[];
    },
    enabled: !!user,
  });

  const createRoomMutation = useMutation({
    mutationFn: async (room: { name: string; type: string; job_id?: string }) => {
      const { data, error } = await supabase.from("chat_rooms").insert({
        name: room.name,
        type: room.type,
        job_id: room.job_id || null,
        created_by: user!.id,
      }).select().single();
      if (error) {
        await logPolicyErrorIfAny(
          { entity_type: "chat_room", action: "create", extra: { name: room.name, type: room.type } },
          error
        );
        throw error;
      }

      // Auto-join creator
      const { error: memberError } = await supabase.from("chat_room_members").insert({
        room_id: data.id,
        user_id: user!.id,
        role: "admin",
      });
      if (memberError) {
        await logPolicyErrorIfAny(
          { entity_type: "chat_room_member", action: "auto_join", entity_id: data.id },
          memberError
        );
        // Non-fatal: room exists; surface but don't throw
      }

      // Audit success
      await logAudit({
        action: "chat_room.created",
        entity_type: "chat_room",
        entity_id: data.id,
        changes: {
          name: data.name,
          type: data.type,
          job_id: data.job_id ?? null,
        },
      });

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-rooms"] }),
  });

  return { rooms: roomsQuery.data ?? [], isLoading: roomsQuery.isLoading, createRoom: createRoomMutation };
}

export function useChatMessages(roomId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_room_messages")
        .select("*")
        .eq("room_id", roomId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!roomId && !!user,
  });

  // Mark room as read when opened and when new messages arrive
  useEffect(() => {
    if (!roomId || !user) return;
    const markRead = async () => {
      await supabase
        .from("chat_room_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", user.id);
      qc.invalidateQueries({ queryKey: ["sidebar-unread-counts"] });
    };
    markRead();
  }, [roomId, user, messagesQuery.data?.length, qc]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_room_messages",
        filter: `room_id=eq.${roomId}`,
      }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
        if (payload.new?.sender_id && payload.new.sender_id !== user?.id) {
          playNotificationSound();
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_room_messages",
        filter: `room_id=eq.${roomId}`,
      }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
        if (payload.new?.sender_id && payload.new.sender_id !== user?.id) {
          if (payload.new.is_deleted && !payload.old?.is_deleted) {
            toast.info("A message was deleted in this conversation");
          } else if (payload.new.edited_at && payload.new.edited_at !== payload.old?.edited_at) {
            toast.info("A message was edited in this conversation");
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, qc, user?.id]);

  const sendMessage = useMutation({
    mutationFn: async ({ content, attachments, replyToId }: { content: string; attachments?: { url: string; path?: string; name: string; type: string }[]; replyToId?: string }) => {
      const metadata = attachments?.length ? { attachments } : {};
      const { error } = await supabase.from("chat_room_messages").insert({
        room_id: roomId!,
        sender_id: user!.id,
        content,
        metadata,
        reply_to_id: replyToId || null,
      });
      if (error) throw error;
      await supabase.from("chat_rooms").update({ updated_at: new Date().toISOString() }).eq("id", roomId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
      qc.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  const editMessage = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { error } = await supabase
        .from("chat_room_messages")
        .update({ content, edited_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("sender_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-messages", roomId] }),
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("chat_room_messages")
        .update({ content: "This message was deleted", is_deleted: true })
        .eq("id", messageId)
        .eq("sender_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-messages", roomId] }),
  });

  return { messages: messagesQuery.data ?? [], isLoading: messagesQuery.isLoading, sendMessage, editMessage, deleteMessage };
}

export function useChatMembers(roomId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["chat-members", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_room_members")
        .select("*")
        .eq("room_id", roomId!);
      if (error) throw error;
      // Fetch profiles for each member
      const userIds = data.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      return data.map((m: any) => ({
        ...m,
        profile: profiles?.find((p: any) => p.user_id === m.user_id),
      })) as ChatMember[];
    },
    enabled: !!roomId && !!user,
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("chat_room_members").insert({
        room_id: roomId!,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-members", roomId] }),
  });

  return { members: membersQuery.data ?? [], isLoading: membersQuery.isLoading, addMember };
}
