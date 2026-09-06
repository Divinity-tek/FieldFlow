import { useMemo } from "react";
import {
  Briefcase, Clock, CircleCheck, CircleX, ArrowRight, Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

// ── Types ────────────────────────────────────────────────────────────────────
type NominationStatus = "pending" | "approved" | "rejected";

interface NominationRow {
  id: string;
  job_id: string;
  candidate_name: string;
  status: NominationStatus;
  created_at: string;
  jobs?: { title: string | null } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge = (status: NominationStatus) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-700 border-green-300" variant="outline">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-700 border-red-300" variant="outline">Rejected</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 border-amber-300" variant="outline">Pending</Badge>;
  }
};

// ── Component ──────────────────────────────────────────────────────────────
const RecruiterDashboard = () => {
  const { user } = useAuth();

  // Jobs currently assigned to this recruiter (via job_recruiters join table)
  const { data: assignedJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["recruiter-assigned-jobs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("job_recruiters")
        .select("job_id, jobs(id, title, status)")
        .eq("recruiter_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // All nominations this recruiter has made
  const { data: nominations = [], isLoading: nominationsLoading } = useQuery({
    queryKey: ["recruiter-nominations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("candidate_nominations")
        .select("id, job_id, candidate_name, status, created_at, jobs(title)")
        .eq("recruiter_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NominationRow[];
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const total = nominations.length;
    const pending = nominations.filter((n) => n.status === "pending").length;
    const approved = nominations.filter((n) => n.status === "approved").length;
    const rejected = nominations.filter((n) => n.status === "rejected").length;
    return { assignedJobs: assignedJobs.length, total, pending, approved, rejected };
  }, [assignedJobs, nominations]);

  const recentNominations = nominations.slice(0, 8);

  return (
    <AppLayout title="Recruiter Dashboard" subtitle="Your assigned jobs and candidate nominations">
      <div className="space-y-6">

        {/* ── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Briefcase, label: "Assigned Jobs", value: stats.assignedJobs, color: "text-blue-600" },
            { icon: Clock, label: "Pending Review", value: stats.pending, color: "text-amber-600" },
            { icon: CircleCheck, label: "Approved", value: stats.approved, color: "text-green-600" },
            { icon: CircleX, label: "Rejected", value: stats.rejected, color: "text-red-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
              <div className="p-6 pt-4 pb-3 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${color} opacity-20`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Assigned Jobs quick list ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex items-center justify-between p-6 pb-3">
            <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Your Assigned Jobs
            </h3>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/recruiter/jobs">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
          <div className="px-6 pb-6">
            {jobsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading jobs…</p>
            ) : assignedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No jobs assigned to you yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedJobs.slice(0, 5).map((row: any) => (
                  <div key={row.job_id} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{row.jobs?.title ?? "Untitled job"}</p>
                      <p className="text-xs text-muted-foreground">{row.jobs?.status ?? "—"}</p>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="gap-1.5">
                      <Link to={`/recruiter/nominate/${row.job_id}`}>
                        <Users className="w-3.5 h-3.5" /> Nominate
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Nominations ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-3">
            <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Recent Nominations
            </h3>
          </div>
          <div className="p-0">
            {nominationsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
            ) : recentNominations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">You haven't nominated any candidates yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b bg-muted/40">
                      {["Candidate", "Job", "Submitted", "Status"].map((h) => (
                        <th key={h} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {recentNominations.map((n) => (
                      <tr key={n.id} className="border-b transition-colors hover:bg-muted/20">
                        <td className="p-4 align-middle font-medium">{n.candidate_name}</td>
                        <td className="p-4 align-middle text-muted-foreground">{n.jobs?.title ?? "—"}</td>
                        <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                          {new Date(n.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 align-middle">{statusBadge(n.status)}</td>
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

export default RecruiterDashboard;
