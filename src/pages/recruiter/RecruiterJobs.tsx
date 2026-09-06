import { useMemo, useState } from "react";
import { Briefcase, Search, X, Users, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

// ── Component ──────────────────────────────────────────────────────────────
// NOTE: adjust the selected `jobs` columns below (title, status, location,
// client_name, created_at) to match your actual `jobs` table schema.
const RecruiterJobs = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["recruiter-jobs-full", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from<any, any>("job_recruiters")
        .select(`
          job_id,
          assigned_at,
          jobs (
            id,
            title,
            status,
            location,
            client_name,
            created_at
          )
        `)
        .eq("recruiter_id", user.id)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const jobs = useMemo(
    () => rows.map((r: any) => ({ ...r.jobs, assigned_at: r.assigned_at })).filter(Boolean),
    [rows]
  );

  const statuses = useMemo(
    () => Array.from(new Set(jobs.map((j: any) => j.status).filter(Boolean))),
    [jobs]
  );

  const filtered = useMemo(() => {
    return jobs.filter((job: any) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        job.title?.toLowerCase().includes(q) ||
        job.location?.toLowerCase().includes(q) ||
        job.client_name?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  return (
    <AppLayout title="Assigned Jobs" subtitle="Job postings you've been assigned to recruit for">
      <div className="space-y-6">
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Jobs
              </h3>
              <Badge variant="secondary" className="ml-2">
                {filtered.length} of {jobs.length}
              </Badge>

              {statuses.length > 0 && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`text-xs px-2.5 py-1 rounded-full border ${statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    All
                  </button>
                  {statuses.map((s: string) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative ml-auto w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 pr-8 h-9 text-sm"
                  placeholder="Search title, location, client…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading jobs…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No jobs match your filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b bg-muted/40">
                      {["Job Title", "Client", "Location", "Status", "Posted"].map((h) => (
                        <th key={h} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                      <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {filtered.map((job: any) => (
                      <tr key={job.id} className="border-b transition-colors hover:bg-muted/20">
                        <td className="p-4 align-middle font-medium whitespace-nowrap">{job.title ?? "Untitled job"}</td>
                        <td className="p-4 align-middle text-muted-foreground">{job.client_name ?? "—"}</td>
                        <td className="p-4 align-middle text-muted-foreground">
                          {job.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" /> {job.location}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-4 align-middle">
                          <Badge variant="outline" className="text-xs font-normal">{job.status ?? "—"}</Badge>
                        </td>
                        <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                          {job.created_at ? new Date(job.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-4 align-middle text-center">
                          <Button asChild size="sm" variant="ghost" className="gap-1.5 h-7 px-2 text-[11px]">
                            <Link to={`/recruiter/nominate/${job.id}`}>
                              <Users className="w-3 h-3" /> Nominate
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default RecruiterJobs;
