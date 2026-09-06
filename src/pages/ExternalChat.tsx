import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { useChatRooms, useChatMessages, useChatMembers } from "@/hooks/useChatRooms";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { usePresence } from "@/hooks/usePresence";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ChatInput from "@/components/chat/ChatInput";
import ChatDropZone from "@/components/chat/ChatDropZone";
import ChatMessageSearch from "@/components/chat/ChatMessageSearch";
import ChatMessageBubble from "@/components/chat/ChatMessageBubble";
import TypingIndicator from "@/components/chat/TypingIndicator";
import PinnedMessagesBanner from "@/components/chat/PinnedMessagesBanner";
import PresenceDot from "@/components/chat/PresenceDot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageCircle, Plus, Headphones, Globe, Search, Clock, CheckCircle2,
} from "lucide-react";

const ExternalChat = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("client_support");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("client_support");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handleFilesDropped = useCallback((files: File[]) => setDroppedFiles(files), []);

  const { rooms, isLoading: roomsLoading, createRoom } = useChatRooms(activeTab);
  const { messages, sendMessage, editMessage, deleteMessage } = useChatMessages(activeRoom);
  const { members, addMember } = useChatMembers(activeRoom);
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(activeRoom);
  const { reactions, toggleReaction } = useMessageReactions(activeRoom);
  const { pinnedMessages, togglePin } = usePinnedMessages(activeRoom);

  const { isOnline, onlineCount } = usePresence(activeRoom);
  const senderIds = useMemo(() => [...new Set(messages.map(m => m.sender_id))], [messages]);
  const { data: senderProfiles } = useQuery({
    queryKey: ["ext-chat-sender-profiles", senderIds],
    queryFn: async () => {
      if (!senderIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", senderIds);
      return data ?? [];
    },
    enabled: senderIds.length > 0,
  });

  const { data: clients } = useQuery({
    queryKey: ["chat-clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, contact_name, company_name, user_id").order("company_name");
      return data ?? [];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const room = await createRoom.mutateAsync({ name: newRoomName, type: newRoomType });
      // If linking to client, add their user_id as member
      if (selectedClientId) {
        const client = clients?.find(c => c.id === selectedClientId);
        if (client?.user_id) {
          await supabase.from("chat_room_members").insert({ room_id: room.id, user_id: client.user_id });
        }
      }
      setActiveRoom(room.id);
      setCreateOpen(false);
      setNewRoomName("");
      setSelectedClientId("");
      toast.success("Support chat created");
    } catch {
      toast.error("Failed to create chat");
    }
  };

  const handleSend = (content: string, attachments?: { url: string; path?: string; name: string; type: string }[]) => {
    if (!activeRoom) return;
    sendMessage.mutate({ content, attachments, replyToId: replyToId || undefined });
    setReplyToId(null);
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return "You";
    return senderProfiles?.find(p => p.user_id === senderId)?.full_name ?? "Visitor";
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const activeRoomData = rooms.find(r => r.id === activeRoom);
  const otherMembers = members.filter(m => m.user_id !== user?.id);

  const getReadByNames = (msgCreatedAt: string) => {
    return otherMembers
      .filter(m => m.last_read_at && new Date(m.last_read_at) >= new Date(msgCreatedAt))
      .map(m => m.profile?.full_name ?? "Unknown");
  };

  const replyingToMessage = replyToId ? messages.find(m => m.id === replyToId) : null;
  const replyingTo = replyingToMessage
    ? { senderName: getSenderName(replyingToMessage.sender_id), content: replyingToMessage.content }
    : null;

  const getReplyTo = (msg: any) => {
    if (!msg.reply_to_id) return null;
    const parent = messages.find(m => m.id === msg.reply_to_id);
    if (!parent) return null;
    return { senderName: getSenderName(parent.sender_id), content: parent.content };
  };

  return (
    <AppLayout title="External Chat" subtitle="Client support & live chat widget conversations">
      <div className="space-y-3">
        <ChatMessageSearch onJumpToRoom={(roomId) => { setActiveRoom(roomId); }} />
      </div>
      <div className="flex h-[calc(100vh-170px)] gap-4">
        {/* Sidebar */}
        <div className="w-80 flex flex-col border rounded-xl bg-card">
          <div className="p-3 border-b space-y-3">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setActiveRoom(null); }}>
              <TabsList className="w-full">
                <TabsTrigger value="client_support" className="flex-1 text-xs">
                  <Headphones className="w-3 h-3 mr-1" /> Support
                </TabsTrigger>
                <TabsTrigger value="live_chat" className="flex-1 text-xs">
                  <Globe className="w-3 h-3 mr-1" /> Live Chat
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-8 h-8 text-xs"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New {activeTab === "client_support" ? "Support Chat" : "Live Chat"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Conversation name" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} />
                    {activeTab === "client_support" && (
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue placeholder="Link to client..." /></SelectTrigger>
                        <SelectContent>
                          {clients?.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.contact_name} — {c.company_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button onClick={handleCreateRoom} className="w-full" disabled={createRoom.isPending}>
                      Create Chat
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {roomsLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No conversations yet</div>
            ) : (
              filteredRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoom(room.id)}
                  className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-accent/30 ${
                    activeRoom === room.id ? "bg-accent/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {room.type === "live_chat" ? (
                      <Globe className="w-4 h-4 text-accent" />
                    ) : (
                      <Headphones className="w-4 h-4 text-primary" />
                    )}
                    <span className="text-sm font-medium truncate">{room.name}</span>
                    <Badge variant="outline" className="ml-auto text-[9px]">
                      {room.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(room.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <ChatDropZone onFilesDropped={handleFilesDropped} className="flex-1 flex flex-col border rounded-xl bg-card">
          {activeRoom && activeRoomData ? (
            <>
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    activeRoomData.type === "live_chat" ? "bg-accent/10" : "bg-primary/10"
                  }`}>
                    {activeRoomData.type === "live_chat" ? (
                      <Globe className="w-4 h-4 text-accent" />
                    ) : (
                      <Headphones className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{activeRoomData.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={activeRoomData.status === "active" ? "default" : "secondary"} className="text-[9px]">
                        {activeRoomData.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {members.length} participant{members.length !== 1 ? "s" : ""} · <span className="text-emerald-500">{onlineCount} online</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                    toast.success("Conversation resolved");
                  }}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolve
                  </Button>
                </div>
              </div>

              <PinnedMessagesBanner
                pinnedMessages={pinnedMessages}
                getSenderName={getSenderName}
                onUnpin={(msgId) => togglePin.mutate({ messageId: msgId, pinned: false })}
              />

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                  {messages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    const name = getSenderName(msg.sender_id);
                    const pinned = pinnedMessages.some(p => p.id === msg.id);
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
                        isPinned={pinned}
                        onTogglePin={(msgId, pin) => togglePin.mutate({ messageId: msgId, pinned: pin })}
                        readByNames={isMe ? getReadByNames(msg.created_at) : undefined}
                        totalOtherMembers={isMe ? otherMembers.length : undefined}
                        replyTo={getReplyTo(msg)}
                        onReply={(msgId) => setReplyToId(msgId)}
                        onEdit={(msgId, newContent) => editMessage.mutate({ messageId: msgId, content: newContent })}
                        onDelete={(msgId) => deleteMessage.mutate(msgId)}
                        editedAt={msg.edited_at}
                        isDeleted={msg.is_deleted}
                        senderIsOnline={isOnline(msg.sender_id)}
                        senderId={msg.sender_id}
                      />
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <TypingIndicator typingUsers={typingUsers} />

              {/* Input */}
              <div className="p-4 border-t">
                <ChatInput
                  onSend={handleSend}
                  disabled={!activeRoom}
                  placeholder="Type a reply..."
                  onTyping={() => sendTyping(senderProfiles?.find(p => p.user_id === user?.id)?.full_name ?? user?.email ?? "Support")}
                  onStopTyping={stopTyping}
                  replyingTo={replyingTo}
                  onCancelReply={() => setReplyToId(null)}
                  externalFiles={droppedFiles}
                  onExternalFilesConsumed={() => setDroppedFiles([])}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs mt-1">Or create a new support chat to get started</p>
            </div>
          )}
        </ChatDropZone>
      </div>
    </AppLayout>
  );
};

export default ExternalChat;
