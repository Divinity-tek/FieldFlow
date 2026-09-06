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
import UserProfileCard from "@/components/chat/UserProfileCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  MessageSquare, Plus, Users, Briefcase, Hash, Search, UserPlus,
} from "lucide-react";

const InternalChat = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("internal_team");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("internal_team");
  const [newRoomJobId, setNewRoomJobId] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
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
    queryKey: ["chat-sender-profiles", senderIds],
    queryFn: async () => {
      if (!senderIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", senderIds);
      return data ?? [];
    },
    enabled: senderIds.length > 0,
  });

  // Jobs for job-specific chat
  const { data: jobs } = useQuery({
    queryKey: ["chat-jobs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id, title").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // All profiles for adding members
  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles-for-chat"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
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
      const room = await createRoom.mutateAsync({
        name: newRoomName,
        type: newRoomType,
        job_id: newRoomJobId || undefined,
      });
      setActiveRoom(room.id);
      setCreateOpen(false);
      setNewRoomName("");
      setNewRoomJobId("");
      toast.success("Chat room created");
    } catch {
      toast.error("Failed to create room");
    }
  };

  const handleSend = (content: string, attachments?: { url: string; path?: string; name: string; type: string }[]) => {
    if (!activeRoom) return;
    sendMessage.mutate({ content, attachments, replyToId: replyToId || undefined });
    setReplyToId(null);
  };


  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync(selectedUserId);
      setAddMemberOpen(false);
      setSelectedUserId("");
      toast.success("Member added");
    } catch {
      toast.error("Failed to add member");
    }
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return "You";
    return senderProfiles?.find(p => p.user_id === senderId)?.full_name ?? "Unknown";
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const activeRoomData = rooms.find(r => r.id === activeRoom);
  const otherMembers = members.filter(m => m.user_id !== user?.id);

  const getReadInfo = (msgCreatedAt: string, senderId: string) => {
    const others = members.filter(m => m.user_id !== senderId);
    const readers = others
      .filter(m => m.last_read_at && new Date(m.last_read_at) >= new Date(msgCreatedAt))
      .map(m => m.profile?.full_name ?? "Unknown");
    return { readers, total: others.length };
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
    <AppLayout title="Internal Chat" subtitle="Team messaging & job-specific collaboration">
      <div className="space-y-3">
        <ChatMessageSearch onJumpToRoom={(roomId) => { setActiveRoom(roomId); }} />
      </div>
      <div className="flex h-[calc(100vh-170px)] gap-4">
        {/* Sidebar */}
        <div className="w-80 flex flex-col border rounded-xl bg-card">
          <div className="p-3 border-b space-y-3">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setActiveRoom(null); }}>
              <TabsList className="w-full">
                <TabsTrigger value="internal_team" className="flex-1 text-xs">
                  <Hash className="w-3 h-3 mr-1" /> Team
                </TabsTrigger>
                <TabsTrigger value="job_specific" className="flex-1 text-xs">
                  <Briefcase className="w-3 h-3 mr-1" /> Jobs
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search channels..."
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
                    <DialogTitle>Create Chat Room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Room name" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} />
                    <Select value={newRoomType} onValueChange={setNewRoomType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal_team">Team Channel</SelectItem>
                        <SelectItem value="job_specific">Job Chat</SelectItem>
                      </SelectContent>
                    </Select>
                    {newRoomType === "job_specific" && (
                      <Select value={newRoomJobId} onValueChange={setNewRoomJobId}>
                        <SelectTrigger><SelectValue placeholder="Link to job..." /></SelectTrigger>
                        <SelectContent>
                          {jobs?.map(j => (
                            <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button onClick={handleCreateRoom} className="w-full" disabled={createRoom.isPending}>
                      Create Room
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
              <div className="p-4 text-center text-sm text-muted-foreground">No channels yet</div>
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
                    {room.type === "job_specific" ? (
                      <Briefcase className="w-4 h-4 text-primary" />
                    ) : (
                      <Hash className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium truncate">{room.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(room.updated_at).toLocaleDateString()}
                  </p>
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
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    {activeRoomData.type === "job_specific" ? (
                      <Briefcase className="w-4 h-4 text-primary" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{activeRoomData.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {members.length} member{members.length !== 1 ? "s" : ""} · <span className="text-emerald-500">{onlineCount} online</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <UserPlus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Member</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                          <SelectContent>
                            {allProfiles?.filter(p => !members.some(m => m.user_id === p.user_id)).map(p => (
                              <SelectItem key={p.user_id} value={p.user_id}>
                                {p.full_name} ({p.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAddMember} className="w-full">Add Member</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="flex -space-x-2">
                    {members.slice(0, 5).map(m => (
                      <UserProfileCard key={m.id} userId={m.user_id} isOnline={isOnline(m.user_id)}>
                        <button type="button" className="relative cursor-pointer">
                          <Avatar className="w-7 h-7 border-2 border-background">
                            <AvatarFallback className="text-[9px] bg-primary/10">
                              {getInitials(m.profile?.full_name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <PresenceDot isOnline={isOnline(m.user_id)} className="absolute -bottom-0.5 -right-0.5" />
                        </button>
                      </UserProfileCard>
                    ))}
                    {members.length > 5 && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium border-2 border-background">
                        +{members.length - 5}
                      </div>
                    )}
                  </div>
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
                  {messages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    const name = getSenderName(msg.sender_id);
                    const pinned = pinnedMessages.some(p => p.id === msg.id);
                    const reads = getReadInfo(msg.created_at, msg.sender_id);
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
                        readByNames={reads.readers}
                        totalOtherMembers={reads.total}
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
                  onTyping={() => sendTyping(allProfiles?.find(p => p.user_id === user?.id)?.full_name ?? user?.email ?? "User")}
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
              <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Select a channel to start chatting</p>
              <p className="text-xs mt-1">Or create a new one to get started</p>
            </div>
          )}
        </ChatDropZone>
      </div>
    </AppLayout>
  );
};

export default InternalChat;
