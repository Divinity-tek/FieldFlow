import { useState, useCallback } from "react";
import { toast } from "sonner";

const AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-job-report`;

export function useAIStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const stream = useCallback(async (type: string, data: Record<string, unknown>) => {
    setContent("");
    setIsStreaming(true);

    try {
      const resp = await fetch(AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ type, data }),
      });

      if (resp.status === 429) { toast.error("Rate limit exceeded. Please wait and try again."); setIsStreaming(false); return ""; }
      if (resp.status === 402) { toast.error("AI credits exhausted. Please add funds in workspace settings."); setIsStreaming(false); return ""; }
      if (!resp.ok || !resp.body) throw new Error("Failed to start stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) { full += c; setContent(full); }
          } catch { /* partial */ }
        }
      }

      setIsStreaming(false);
      return full;
    } catch (e) {
      console.error(e);
      toast.error("AI generation failed");
      setIsStreaming(false);
      return "";
    }
  }, []);

  return { content, isStreaming, stream, setContent };
}
