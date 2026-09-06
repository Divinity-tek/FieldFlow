import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, ExternalLink, HelpCircle, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HELP_DOCS, type HelpDoc } from "@/lib/helpDocs";
import { resolveHelpDoc } from "@/lib/helpRouteMatch";
import { roleCanAccess, rolesForPath, type HelpRole } from "@/lib/helpRoles";
import { useUserRole } from "@/hooks/useUserRole";

interface ContextualHelpDrawerProps {
  /** Override the page path used to look up the doc; defaults to current pathname. */
  path?: string;
  /** Override the slug if you want to point this button at a specific doc. */
  slug?: string;
  /** Visual variant of the trigger button. */
  variant?: "icon" | "button";
  /** Optional label override for the button trigger. */
  label?: string;
}

const ROLE_LABELS: Record<HelpRole, string> = {
  admin: "Admin",
  team_lead: "Team Lead",
  engineer: "Engineer",
  client: "Client",
  partner: "Partner",
  associate_coordinator: "Coordinator",
};

/** Picks the most specific HelpDoc that matches a given pathname. */
function pickDocForPath(pathname: string): HelpDoc | undefined {
  return resolveHelpDoc(pathname);
}

const ContextualHelpDrawer = ({ path, slug, variant = "icon", label = "Help" }: ContextualHelpDrawerProps) => {
  const location = useLocation();
  const effectivePath = path ?? location.pathname;
  const { role } = useUserRole();
  const [showAll, setShowAll] = useState(false);

  const doc = useMemo<HelpDoc | undefined>(() => {
    if (slug) return HELP_DOCS.find((d) => d.slug === slug);
    return pickDocForPath(effectivePath);
  }, [slug, effectivePath]);

  // Filter sections — drop the generic "Who can access it" line; we render a richer role badge instead.
  const visibleSections = useMemo(
    () => doc?.sections.filter((s) => s.heading !== "Who can access it") ?? [],
    [doc]
  );

  const docRoles = useMemo<HelpRole[]>(() => rolesForPath(doc?.path), [doc]);
  const userHasAccess = roleCanAccess(role as HelpRole | null, doc?.path);

  // Related docs in the same category, filtered to the current role unless the user toggles "show all".
  const related = useMemo(() => {
    if (!doc) return [] as HelpDoc[];
    return HELP_DOCS
      .filter((d) => d.slug !== doc.slug && d.category === doc.category)
      .filter((d) => showAll || !role || roleCanAccess(role as HelpRole, d.path))
      .slice(0, 6);
  }, [doc, role, showAll]);

  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            {variant === "icon" ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Open help for this page"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5">
                <HelpCircle className="h-4 w-4" />
                {label}
              </Button>
            )}
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{doc ? `Help: ${doc.title}` : "Help"}</p>
        </TooltipContent>
      </Tooltip>

      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-5 pb-3 border-b">
          {doc ? (
            <>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                {role && (
                  userHasAccess ? (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <ShieldCheck className="h-3 w-3" /> Available to your role
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <Lock className="h-3 w-3" /> Restricted
                    </Badge>
                  )
                )}
              </div>
              <SheetTitle className="text-base text-left">{doc.title}</SheetTitle>
              <SheetDescription className="text-left">{doc.summary}</SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle className="text-base text-left">Help</SheetTitle>
              <SheetDescription className="text-left">
                We don't have a dedicated guide for this page yet. Browse the full help center for related topics.
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {doc && !userHasAccess && role && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
                Your role ({ROLE_LABELS[role as HelpRole]}) doesn't have access to this section. The guidance
                below is shown for reference.
              </div>
            )}

            {visibleSections.map((sec, i) => (
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

            {doc && (
              <section>
                <h3 className="text-sm font-semibold mb-1.5">Who can access it</h3>
                <div className="flex flex-wrap gap-1">
                  {docRoles.length === Object.keys(ROLE_LABELS).length ? (
                    <Badge variant="outline" className="text-[10px]">All signed-in users</Badge>
                  ) : (
                    docRoles.map((r) => (
                      <Badge
                        key={r}
                        variant={role === r ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {ROLE_LABELS[r]}
                      </Badge>
                    ))
                  )}
                </div>
              </section>
            )}

            {!doc && (
              <p className="text-sm text-muted-foreground">
                Use the link below to open the searchable help center.
              </p>
            )}

            {doc && related.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Related for your role</h3>
                  {role && (
                    <div className="flex items-center gap-1.5">
                      <Switch
                        id="help-show-all"
                        checked={showAll}
                        onCheckedChange={setShowAll}
                        className="scale-75"
                      />
                      <Label htmlFor="help-show-all" className="text-[10px] text-muted-foreground cursor-pointer">
                        Show all
                      </Label>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {related.map((r) => {
                    const accessible = !role || roleCanAccess(role as HelpRole, r.path);
                    return (
                      <Link
                        key={r.slug}
                        to={`/help/${r.slug}`}
                        className="block rounded border border-border/60 hover:border-primary/50 bg-card p-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate">{r.title}</span>
                          {!accessible && (
                            <Badge variant="outline" className="text-[9px] gap-0.5">
                              <Lock className="h-2.5 w-2.5" /> restricted
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{r.summary}</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="p-4 flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/help">
              <BookOpen className="h-4 w-4" /> All topics
            </Link>
          </Button>
          {doc?.path && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={`/help/${doc.slug}`}>
                Full doc <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ContextualHelpDrawer;

