import { useState, type FormEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, UserPlus, Mail, Phone, FileText, Briefcase } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";

// ── Types ────────────────────────────────────────────────────────────────────
type NominationStatus = "pending" | "approved" | "rejected";

// ── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge = (status: NominationStatus) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-700 border-green-300" variant="outline">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-700 border-red-300" variant="outline">Rejected</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 border-amber-300" variant="outline">Pending Review</Badge>;
  }
};

const emptyForm = {
  candidate_name: "",
  candidate_email: "",
  candidate_phone: "",
  resume_url: "",
  notes: "",
};

// ── Component ──────────────────────────────────────────────────────────────
const NominateCandidate = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // Confirms this recruiter is actually assigned to the job, and pulls basic
  // job details for the header. RLS should also enforce this server-side.
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["recruiter-nominate-job", jobId, user?.id],
    queryFn: async () => {
      if (!jobId || !user) return null;
      const { data: assignment, error: assignmentError } = await supabase
        .from("job_recruiters")
        .select("job_id")
        .eq("job_id", jobId)
        .eq("recruiter_id", user.id)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return null; // not assigned to this job

      const { data: jobRow, error: jobError } = await supabase
        .from("jobs")
        .select("id, title, status, location, client_name")
        .eq("id", jobId)
        .maybeSingle();
      if (jobError) throw jobError;
      return jobRow;
    },
    enabled: !!jobId && !!user,
  });

  // This recruiter's own past nominations for this specific job
  const { data: pastNominations = [], isLoading: nominationsLoading } = useQuery({
    queryKey: ["recruiter-job-nominations", jobId, user?.id],
    queryFn: async () => {
      if (!jobId || !user) return [];
      const { data, error } = await supabase
        .from("candidate_nominations")
        .select("id, candidate_name, candidate_email, status, created_at, review_notes")
        .eq("job_id", jobId)
        .eq("recruiter_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!jobId && !!user,
  });

  const validateEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.candidate_name.trim()) {
      toast.error("Candidate name required");
      return;
    }
    if (!validateEmail(form.candidate_email)) {
      toast.error("Invalid email address");
      return;
    }
    if (!jobId || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("candidate_nominations").insert({
        job_id: jobId,
        recruiter_id: user.id,
        candidate_name: form.candidate_name.trim(),
        candidate_email: form.candidate_email.trim() || null,
        candidate_phone: form.candidate_phone.trim() || null,
        resume_url: form.resume_url.trim() || null,
        notes: form.notes.trim() || null,
        status: "pending",
      });
      if (error) throw error;

      toast.success(`${form.candidate_name.trim()} nominated for review 🎉`);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["recruiter-job-nominations", jobId, user.id] });
      queryClient.invalidateQueries({ queryKey: ["recruiter-nominations", user.id] });
    } catch (err: any) {
      toast.error("Failed to submit nomination", { description: err?.message ?? "Something went wrong." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!jobLoading && !job) {
    return (
      <AppLayout title="Nominate Candidate" subtitle="">
        <div className="rounded-xl border border-border/50 bg-card/95 p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            You're not assigned to this job, or it doesn't exist.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/recruiter/jobs"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to your jobs</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Nominate Candidate" subtitle={job?.title ?? ""}>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/recruiter/jobs")}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to jobs
        </Button>

        {/* ── Job summary ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold">{job?.title ?? "Loading…"}</h3>
            {job?.status && <Badge variant="outline" className="text-xs font-normal">{job.status}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {[job?.client_name, job?.location].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>

        {/* ── Nomination form ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Nominate a Candidate
            </h3>
          </div>
          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cand-name">Candidate Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="cand-name"
                    placeholder="e.g. Priya Sharma"
                    value={form.candidate_name}
                    onChange={(e) => setField("candidate_name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cand-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="cand-email"
                      type="email"
                      className="pl-8"
                      placeholder="candidate@example.com"
                      value={form.candidate_email}
                      onChange={(e) => setField("candidate_email", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cand-phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="cand-phone"
                      type="tel"
                      className="pl-8"
                      placeholder="+1 555 123 4567"
                      value={form.candidate_phone}
                      onChange={(e) => setField("candidate_phone", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cand-resume">Resume / Portfolio Link</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="cand-resume"
                      className="pl-8"
                      placeholder="https://…"
                      value={form.resume_url}
                      onChange={(e) => setField("resume_url", e.target.value)}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="cand-notes">Notes for Reviewer</Label>
                  <Textarea
                    id="cand-notes"
                    placeholder="Why this candidate is a good fit…"
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting || !form.candidate_name.trim()} className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? "Submitting…" : "Submit for Review"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>Clear</Button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Past nominations for this job ───────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-3">
            <h3 className="text-xl font-semibold leading-none tracking-tight">Your Nominations for This Job</h3>
          </div>
          <div className="p-0">
            {nominationsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
            ) : pastNominations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No nominations submitted yet for this job.</p>
            ) : (
              <div className="divide-y divide-border">
                {pastNominations.map((n: any) => (
                  <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{n.candidate_name}</p>
                      {n.candidate_email && <p className="text-xs text-muted-foreground">{n.candidate_email}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Submitted {new Date(n.created_at).toLocaleDateString()}
                      </p>
                      {n.review_notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Reviewer note: {n.review_notes}</p>
                      )}
                    </div>
                    {statusBadge(n.status)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NominateCandidate;
