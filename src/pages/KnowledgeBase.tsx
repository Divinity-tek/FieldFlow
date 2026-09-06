import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus, Search, Eye, ThumbsUp, Tag, FileText } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import AskAIButton from "@/components/ai/AskAIButton";

const articleCategories = ["Installation Guide", "Troubleshooting", "Network Config", "Safety", "Best Practices", "Hardware", "Software", "General"];

const KnowledgeBase = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "General", tags: "", is_published: true });

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["knowledge-articles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("knowledge_articles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("knowledge_articles").insert({
        title: f.title,
        content: f.content,
        category: f.category,
        tags: f.tags ? f.tags.split(",").map(t => t.trim()) : [],
        is_published: f.is_published,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      toast.success("Article published");
      setDialogOpen(false);
      setForm({ title: "", content: "", category: "General", tags: "", is_published: true });
    },
    onError: () => toast.error("Failed to create article"),
  });

  const filtered = articles.filter((a: any) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase()) || (a.tags || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = filterCategory === "all" || a.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalViews = articles.reduce((sum: number, a: any) => sum + (a.views_count || 0), 0);
  const totalHelpful = articles.reduce((sum: number, a: any) => sum + (a.helpful_count || 0), 0);
  const publishedCount = articles.filter((a: any) => a.is_published).length;

  if (selectedArticle) {
    return (
      <AppLayout title="Knowledge Base" subtitle="Technical documentation and guides">
        <div className="max-w-4xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => setSelectedArticle(null)}>← Back to articles</Button>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{selectedArticle.category}</Badge>
                {(selectedArticle.tags || []).map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
              <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {selectedArticle.views_count} views</span>
                <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {selectedArticle.helpful_count} helpful</span>
                <span>{new Date(selectedArticle.created_at).toLocaleDateString()}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Knowledge Base" subtitle="Technical documentation, guides, and troubleshooting articles">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold">{articles.length}</p><p className="text-xs text-muted-foreground">Total Articles</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center"><FileText className="w-5 h-5 text-green-500" /></div><div><p className="text-2xl font-bold">{publishedCount}</p><p className="text-xs text-muted-foreground">Published</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Eye className="w-5 h-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{totalViews}</p><p className="text-xs text-muted-foreground">Total Views</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center"><ThumbsUp className="w-5 h-5 text-yellow-500" /></div><div><p className="text-2xl font-bold">{totalHelpful}</p><p className="text-xs text-muted-foreground">Helpful Votes</p></div></div></CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by title, content, or tags…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {articleCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-1" /> New Article</Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Write a new knowledge base article with Markdown</p></TooltipContent>
              </Tooltip>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Article</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Title *</Label><Input placeholder="e.g. How to configure VLAN settings" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{articleCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="e.g. wifi, router, config" /></div>
                </div>
                <div><Label>Content (Markdown supported) *</Label><Textarea placeholder="Write your article content here… Use **bold**, *italic*, ## headings, and - lists." value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={10} /></div>
                <Button onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.content || createMutation.isPending}>
                  {createMutation.isPending ? "Publishing..." : "Publish Article"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <AskAIButton prompt="Analyze knowledge base usage, suggest missing documentation topics, and identify most searched but unfound queries." label="AI Analysis" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <p className="text-muted-foreground col-span-full text-center py-8">Loading articles...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground col-span-full text-center py-8">No articles found</p>
          ) : filtered.map((article: any) => (
            <Card key={article.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedArticle(article)}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-2 mb-2">
                  <Badge variant="outline" className="text-xs shrink-0">{article.category}</Badge>
                  {!article.is_published && <Badge variant="secondary" className="text-xs">Draft</Badge>}
                </div>
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{article.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{article.content.slice(0, 150)}...</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.views_count}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {article.helpful_count}</span>
                  {(article.tags || []).length > 0 && <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {(article.tags || []).length}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default KnowledgeBase;
