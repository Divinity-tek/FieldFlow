import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, BookOpen, ExternalLink, Search } from "lucide-react";
import { HELP_CATEGORIES, HELP_DOCS, findHelpDoc, searchHelpDocs, type HelpCategory, type HelpDoc } from "@/lib/helpDocs";

export default function Help() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const results = useMemo(() => searchHelpDocs(q), [q]);
  const grouped = useMemo(() => {
    const map = new Map<HelpCategory, HelpDoc[]>();
    for (const cat of HELP_CATEGORIES) map.set(cat, []);
    for (const doc of results) map.get(doc.category)?.push(doc);
    return map;
  }, [results]);

  const activeDoc = slug ? findHelpDoc(slug) : undefined;

  return (
    <AppLayout title="Help Center" subtitle="Comprehensive guidance for every section of the app">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <Card className="lg:sticky lg:top-4 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Help Topics
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search help…"
                className="pl-7 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[70vh]">
              <div className="p-2 space-y-3">
                {HELP_CATEGORIES.map((cat) => {
                  const docs = grouped.get(cat) ?? [];
                  if (docs.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {cat}
                      </div>
                      <div className="space-y-0.5">
                        {docs.map((d) => (
                          <button
                            key={d.slug}
                            onClick={() => navigate(`/help/${d.slug}`)}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors ${
                              activeDoc?.slug === d.slug ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {d.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {results.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3">No topics match "{q}".</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Content */}
        <div>
          {activeDoc ? <DocView doc={activeDoc} /> : <Index docs={results} q={q} />}
        </div>
      </div>
    </AppLayout>
  );
}

function Index({ docs, q }: { docs: HelpDoc[]; q: string }) {
  const grouped = useMemo(() => {
    const map = new Map<HelpCategory, HelpDoc[]>();
    for (const cat of HELP_CATEGORIES) map.set(cat, []);
    for (const doc of docs) map.get(doc.category)?.push(doc);
    return map;
  }, [docs]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {q ? `${docs.length} topic${docs.length === 1 ? "" : "s"} for "${q}"` : "Browse all help topics"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a topic from the sidebar or any card below. Every section of the app has a dedicated guide.
          </p>
        </CardHeader>
      </Card>

      {HELP_CATEGORIES.map((cat) => {
        const list = grouped.get(cat) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="text-sm font-semibold mb-2">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {list.map((d) => (
                <Link key={d.slug} to={`/help/${d.slug}`} className="block">
                  <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <span>{d.title}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{d.summary}</p>
                      {d.path && (
                        <Badge variant="outline" className="mt-2 text-[10px] font-mono">
                          {d.path}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DocView({ doc }: { doc: HelpDoc }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Badge variant="outline" className="mb-2 text-[10px]">{doc.category}</Badge>
            <CardTitle className="text-xl">{doc.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{doc.summary}</p>
          </div>
          {doc.path && (
            <Button asChild size="sm" variant="outline">
              <Link to={doc.path}>
                Open page <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Separator />
        {doc.sections.map((sec, i) => (
          <section key={i}>
            <h3 className="text-sm font-semibold mb-1.5">{sec.heading}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{sec.body}</p>
            {sec.bullets && sec.bullets.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {sec.bullets.map((b, j) => (
                  <li key={j} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <Separator />
        <div className="flex items-center justify-between">
          <Link to="/help" className="text-xs text-muted-foreground hover:text-foreground">← All help topics</Link>
          {doc.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {doc.keywords.slice(0, 6).map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
