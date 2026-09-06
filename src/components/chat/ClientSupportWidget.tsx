import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessageBubble from "@/components/chat/ChatMessageBubble";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { Button } from "@/components/ui/button";
import { playNotificationSound } from "@/utils/notificationSound";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Minimize2, Maximize2 } from "lucide-react";

const ClientSupportWidget = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Get or create client's support room
  const { data: room } = useQuery({
    queryKey: ["client-support-room", user?.id],
    queryFn: async () => {
      // Check if user already has a support room
      const { data: memberRooms } = await supabase
        .from("chat_room_members")
        .select("room_id")
        .eq("user_id", user!.id);

      if (memberRooms?.length) {
        const roomIds = memberRooms.map(m => m.room_id);
        const { data: supportRooms } = await supabase
          .from("chat_rooms")
          .select("*")
          .in("id", roomIds)
          .eq("type", "client_support")
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (supportRooms?.length) return supportRooms[0];
      }

      // Create new support room
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();

      const roomName = `Support — ${profile?.full_name ?? "Client"}`;
      const { data: newRoom, error } = await supabase
        .from("chat_rooms")
        .insert({
          name: roomName,
          type: "client_support",
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Add self as member
      await supabase.from("chat_room_members").insert({
        room_id: newRoom.id,
        user_id: user!.id,
        role: "member",
      });

      return newRoom;
    },
    enabled: !!user,
  });

  const roomId = room?.id ?? null;
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(roomId);
  const { reactions, toggleReaction } = useMessageReactions(roomId);

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ["client-widget-messages", roomId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_room_messages")
        .select("*")
        .eq("room_id", roomId!)
        .order("created_at", { ascending: true })
        .limit(100);
      return data ?? [];
    },
    enabled: !!roomId && open,
  });

  // Sender profiles
  const senderIds = useMemo(() => [...new Set(messages.map(m => m.sender_id))], [messages]);
  const { data: profiles } = useQuery({
    queryKey: ["widget-sender-profiles", senderIds],
    queryFn: async () => {
      if (!senderIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", senderIds);
      return data ?? [];
    },
    enabled: senderIds.length > 0,
  });

  // Realtime
  useEffect(() => {
    if (!roomId || !open) return;
    const channel = supabase
      .channel(`widget-${roomId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_room_messages",
        filter: `room_id=eq.${roomId}`,
      }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["client-widget-messages", roomId] });
        if (payload.new?.sender_id && payload.new.sender_id !== user?.id) {
          playNotificationSound();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, open, qc]);

  // Unread count (messages from others since last open)
  const unreadCount = useMemo(() => {
    if (open) return 0;
    return messages.filter(m => m.sender_id !== user?.id).length > 0 ? messages.filter(m => m.sender_id !== user?.id).length : 0;
  }, [messages, open, user?.id]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: { url: string; path?: string; name: string; type: string }[] }) => {
      const metadata = attachments?.length ? { attachments } : {};
      const { error } = await supabase.from("chat_room_messages").insert({
        room_id: roomId!,
        sender_id: user!.id,
        content,
        metadata,
      });
      if (error) throw error;
      await supabase.from("chat_rooms").update({ updated_at: new Date().toISOString() }).eq("id", roomId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-widget-messages", roomId] });
    },
  });

  const handleSend = (content: string, attachments?: { url: string; path?: string; name: string; type: string }[]) => {
    if (!roomId) return;
    sendMutation.mutate({ content, attachments });
  };

  const getName = (id: string) => {
    if (id === user?.id) return "You";
    return profiles?.find(p => p.user_id === id)?.full_name ?? "Support";
  };

  if (!user) return null;

  return (
    <>
      {/* Chat Window */}
      {open && (
        <div className={`fixed z-[60] bg-card border border-border rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
          expanded
            ? "bottom-4 right-4 w-[480px] h-[600px]"
            : "bottom-20 right-4 w-[360px] h-[460px]"
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
              <div>
                <h4 className="text-sm font-semibold text-primary-foreground">Support Chat</h4>
                <p className="text-[10px] text-primary-foreground/70">We typically reply within minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-primary-foreground/10 text-primary-foreground transition-colors">
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-primary-foreground/10 text-primary-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Send a message to get help</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Our team will respond shortly</p>
                </div>
              )}
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                const name = getName(msg.sender_id);
                return (
                  <ChatMessageBubble
                    key={msg.id}
                    content={msg.content}
                    senderName={name}
                    isMe={isMe}
                    timestamp={msg.created_at}
                    metadata={msg.metadata}
                    messageId={msg.id}
                    reactions={reactions[msg.id]}
                    currentUserId={user?.id}
                    onToggleReaction={(msgId, emoji) => toggleReaction.mutate({ messageId: msgId, emoji })}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>
           </ScrollArea>

          <TypingIndicator typingUsers={typingUsers} />

          {/* Input */}
          <div className="p-3 border-t">
            <ChatInput
              onSend={handleSend}
              compact
              placeholder="Type your message..."
              onTyping={() => sendTyping(user?.email?.split("@")[0] ?? "Client")}
              onStopTyping={stopTyping}
            />
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-[61] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
};

export default ClientSupportWidget;
