import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Article { id: string; title: string; content: string; tags: string[] | null }

export default function KbSearchPanel() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Article[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    const term = `%${q.trim()}%`;
    const { data } = await supabase
      .from("knowledge_articles")
      .select("id,title,content,tags")
      .eq("is_published", true)
      .or(`title.ilike.${term},content.ilike.${term}`)
      .limit(10);
    setResults((data ?? []) as Article[]);
    setLoading(false);
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Knowledge base</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search guides, fixes, manuals…"
            className="h-9"
          />
          <Button size="sm" onClick={search} disabled={loading} className="h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {results.length > 0 && (
          <ul className="space-y-1.5 max-h-64 overflow-auto">
            {results.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setOpen(open === a.id ? null : a.id)}
                  className="w-full text-left p-2 rounded-md hover:bg-muted/50"
                >
                  <div className="text-sm font-medium">{a.title}</div>
                  {open === a.id && (
                    <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.content.slice(0, 600)}{a.content.length > 600 ? "…" : ""}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!loading && q && results.length === 0 && (
          <div className="text-xs text-muted-foreground">No articles match yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
