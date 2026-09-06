import { supabase } from "@/integrations/supabase/client";

const TTL_SECONDS = 60 * 60;

/** Create a short-lived signed URL for any private bucket object. */
export async function signedAssetUrl(
  bucket: string,
  path: string,
  ttl: number = TTL_SECONDS,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
