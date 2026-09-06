import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, Pin, Reply, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import MessageReactions from "./MessageReactions";
import ReadReceipt from "./ReadReceipt";
import PresenceDot from "./PresenceDot";
import UserProfileCard from "./UserProfileCard";
import { resolveAttachmentUrl } from "@/lib/chatAttachmentUrl";
import type { Reaction } from "@/hooks/useMessageReactions";

interface Attachment {
  url: string;
  path?: string;
  name: string;
  type: string;
}

interface ChatMessageBubbleProps {
  content: string;
  senderName: string;
  isMe: boolean;
  timestamp: string;
  metadata?: any;
  messageId?: string;
  reactions?: Reaction[];
  currentUserId?: string;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  isPinned?: boolean;
  onTogglePin?: (messageId: string, pinned: boolean) => void;
  readByNames?: string[];
  totalOtherMembers?: number;
  replyTo?: { senderName: string; content: string } | null;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  editedAt?: string | null;
  isDeleted?: boolean;
  senderIsOnline?: boolean;
  senderId?: string;
}

const ChatMessageBubble = ({ content, senderName, isMe, timestamp, metadata, messageId, reactions, currentUserId, onToggleReaction, isPinned, onTogglePin, readByNames, totalOtherMembers, replyTo, onReply, onEdit, onDelete, editedAt, isDeleted, senderIsOnline, senderId }: ChatMessageBubbleProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const attachments: Attachment[] = (metadata as any)?.attachments ?? [];
  const isImage = (type: string) => type.startsWith("image/");
  const isVideo = (type: string) => type.startsWith("video/");

  const handleSaveEdit = () => {
    if (!messageId || !editContent.trim()) return;
    onEdit?.(messageId, editContent.trim());
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!messageId) return;
    onDelete?.(messageId);
    setShowDeleteConfirm(false);
  };

  return (
    <div className={`group flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
      <div className="relative shrink-0">
        {senderId ? (
          <UserProfileCard userId={senderId} isOnline={senderIsOnline}>
            <button className="cursor-pointer" type="button">
              <Avatar className="w-8 h-8 mt-0.5">
                <AvatarFallback className={`text-[10px] ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
            </button>
          </UserProfileCard>
        ) : (
          <Avatar className="w-8 h-8 mt-0.5">
            <AvatarFallback className={`text-[10px] ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {getInitials(senderName)}
            </AvatarFallback>
          </Avatar>
        )}
        {senderIsOnline !== undefined && (
          <PresenceDot isOnline={senderIsOnline} className="absolute -bottom-0.5 -right-0.5" />
        )}
      </div>
      <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
        <div className={`flex items-center gap-2 mb-1 ${isMe ? "justify-end" : ""}`}>
          <span className="text-xs font-medium">{senderName}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {editedAt && !isDeleted && (
            <span className="text-[9px] text-muted-foreground italic">edited</span>
          )}
          {readByNames !== undefined && totalOtherMembers !== undefined && (
            <ReadReceipt readByNames={readByNames} totalOtherMembers={totalOtherMembers} />
          )}
          {isPinned && <Pin className="w-3 h-3 text-primary" />}
          {!isDeleted && messageId && onTogglePin && (
            <button
              onClick={() => onTogglePin(messageId, !isPinned)}
              className={`opacity-0 group-hover:opacity-100 transition-opacity ${isPinned ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              title={isPinned ? "Unpin message" : "Pin message"}
            >
              <Pin className="w-3 h-3" />
            </button>
          )}
          {!isDeleted && messageId && onReply && (
            <button
              onClick={() => onReply(messageId)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
              title="Reply"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
          {!isDeleted && isMe && messageId && onEdit && (
            <button
              onClick={() => { setEditContent(content); setIsEditing(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
              title="Edit message"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {!isDeleted && isMe && messageId && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              title="Delete message"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className={`flex items-center gap-2 mb-1 text-xs ${isMe ? "justify-end" : ""}`}>
            <span className="text-destructive font-medium">Delete this message?</span>
            <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={handleDelete}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        )}

        {/* Reply context */}
        {replyTo && (
          <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
            <div className="rounded-lg border-l-2 border-primary/50 bg-muted/60 px-2.5 py-1.5 max-w-full">
              <p className="text-[10px] font-semibold text-primary/80">{replyTo.senderName}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{replyTo.content}</p>
            </div>
          </div>
        )}

        {!isDeleted && attachments.length > 0 && (
          <div className={`flex flex-col gap-1.5 mb-1 ${isMe ? "items-end" : "items-start"}`}>
            {attachments.map((att, i) => (
              <AttachmentItem key={i} att={att} isMe={isMe} isImage={isImage(att.type)} isVideo={isVideo(att.type)} />
            ))}
          </div>
        )}

        {/* Edit mode */}
        {isEditing ? (
          <div className={`flex flex-col gap-1.5 ${isMe ? "items-end" : "items-start"}`}>
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="min-h-[36px] max-h-[100px] resize-none text-sm"
              rows={1}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                if (e.key === "Escape") handleCancelEdit();
              }}
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={handleSaveEdit}>
                <Check className="w-3 h-3" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={handleCancelEdit}>
                <X className="w-3 h-3" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {content && content !== "📎 Attachment" && (
              <div className={`rounded-xl px-3 py-2 text-sm ${
                isDeleted
                  ? "bg-muted/50 text-muted-foreground italic"
                  : isMe
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
              }`}>
                {content}
              </div>
            )}
          </>
        )}

        {!isDeleted && messageId && currentUserId && onToggleReaction && (
          <MessageReactions
            reactions={reactions ?? []}
            currentUserId={currentUserId}
            onToggle={(emoji) => onToggleReaction(messageId, emoji)}
            isMe={isMe}
          />
        )}
      </div>
    </div>
  );
};

interface AttachmentItemProps {
  att: Attachment;
  isMe: boolean;
  isImage: boolean;
  isVideo: boolean;
}

const AttachmentItem = ({ att, isMe, isImage, isVideo }: AttachmentItemProps) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolveAttachmentUrl({ path: att.path, url: att.url })
      .then((u) => { if (!cancelled) { setResolvedUrl(u); setLoading(false); } })
      .catch(() => { if (!cancelled) { setResolvedUrl(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [att.path, att.url]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs bg-muted/40 text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading {att.name}…
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs bg-muted/40 text-muted-foreground">
        <FileText className="w-3.5 h-3.5" /> {att.name} (unavailable)
      </div>
    );
  }

  if (isImage) {
    return (
      <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={resolvedUrl}
          alt={att.name}
          className="rounded-xl max-w-[240px] max-h-[200px] object-cover border cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video
        src={resolvedUrl}
        controls
        preload="metadata"
        className="rounded-xl max-w-[280px] max-h-[220px] border bg-black"
      />
    );
  }

  return (
    <a
      href={resolvedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-accent/30 transition-colors ${
        isMe ? "bg-primary/10" : "bg-muted/50"
      }`}
    >
      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="truncate max-w-[160px]">{att.name}</span>
      <Download className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </a>
  );
};

export default ChatMessageBubble;

