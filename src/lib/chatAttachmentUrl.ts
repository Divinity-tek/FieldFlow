import { supabase } from "@/integrations/supabase/client";

const BUCKET = "chat-attachments";
const TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Extracts a storage object path from a legacy public URL pointing at the
 * chat-attachments bucket. Returns null if the URL doesn't match.
 */
export function extractChatAttachmentPath(url: string | undefined | null): string | null {
  if (!url) return null;
  // Match either /object/public/chat-attachments/<path> or /object/sign/chat-attachments/<path>
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/chat-attachments\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  // Already a bare path
  if (!/^https?:/i.test(url) && !url.startsWith("/")) return url;
  return null;
}

/** Create a short-lived signed URL for a chat attachment path. */
export async function signChatAttachment(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Resolve display URL for an attachment metadata entry (path preferred, legacy url fallback). */
export async function resolveAttachmentUrl(att: { path?: string | null; url?: string | null }): Promise<string | null> {
  const path = att.path || extractChatAttachmentPath(att.url);
  if (!path) return att.url ?? null; // not in our bucket; leave as-is
  return signChatAttachment(path);
}
