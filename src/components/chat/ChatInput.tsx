import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Paperclip, X, FileText, Image as ImageIcon, Loader2, Reply, Upload } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string, attachments?: { url: string; path?: string; name: string; type: string }[]) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  onTyping?: () => void;
  onStopTyping?: () => void;
  replyingTo?: { senderName: string; content: string } | null;
  onCancelReply?: () => void;
  externalFiles?: File[];
  onExternalFilesConsumed?: () => void;
}

const ChatInput = ({ onSend, disabled, placeholder = "Type a message...", compact, onTyping, onStopTyping, replyingTo, onCancelReply, externalFiles, onExternalFilesConsumed }: ChatInputProps) => {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const addFiles = useCallback((newFiles: File[]) => {
    const oversized = newFiles.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length) {
      toast.error("Files must be under 50MB");
      return;
    }
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
  }, []);

  // Handle files dropped from external ChatDropZone
  useEffect(() => {
    if (externalFiles && externalFiles.length > 0) {
      addFiles(externalFiles);
      onExternalFilesConsumed?.();
    }
  }, [externalFiles, addFiles, onExternalFilesConsumed]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length) addFiles(droppedFiles);
  }, [addFiles]);
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    addFiles(selected);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadFiles = async (): Promise<{ url: string; path: string; name: string; type: string }[]> => {
    const attachments: { url: string; path: string; name: string; type: string }[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) throw error;
      // Bucket is private — store the storage path; a signed URL is generated at display time.
      // `url` is left blank for new uploads to discourage caching of stale signed URLs.
      attachments.push({ url: "", path, name: file.name, type: file.type });
    }
    return attachments;
  };

  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    try {
      setUploading(true);
      let attachments: { url: string; path?: string; name: string; type: string }[] | undefined;
      if (files.length > 0) {
        attachments = await uploadFiles();
      }
      onSend(input.trim() || (attachments ? "📎 Attachment" : ""), attachments);
      setInput("");
      setFiles([]);
    } catch {
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const isImage = (file: File) => file.type.startsWith("image/");
  const isVideo = (file: File) => file.type.startsWith("video/");

  return (
    <div
      className="space-y-2 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1 text-primary">
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">Drop files here</span>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-2">
          <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary">{replyingTo.senderName}</p>
            <p className="text-xs text-muted-foreground truncate">{replyingTo.content}</p>
          </div>
          <button onClick={onCancelReply} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((file, idx) => (
            <div key={idx} className="relative group rounded-lg border bg-muted/50 p-1.5 flex items-center gap-2 text-xs max-w-[180px]">
              {isImage(file) ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-8 h-8 rounded object-cover"
                />
              ) : isVideo(file) ? (
                <video src={URL.createObjectURL(file)} className="w-8 h-8 rounded object-cover" muted />
              ) : (
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => removeFile(idx)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
          className="hidden"
          onChange={handleFiles}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={compact ? "h-9 w-9 shrink-0" : "shrink-0"}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <Textarea
          placeholder={placeholder}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            if (e.target.value.trim()) onTyping?.();
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onStopTyping?.();
              handleSend();
            }
          }}
          onBlur={() => onStopTyping?.()}
          className={`resize-none ${compact ? "min-h-[36px] max-h-[80px] text-sm" : "min-h-[40px] max-h-[120px]"}`}
          rows={1}
          disabled={uploading}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || uploading || (!input.trim() && files.length === 0)}
          size="icon"
          className={compact ? "h-9 w-9 shrink-0" : "shrink-0"}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
