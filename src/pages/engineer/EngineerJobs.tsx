import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import EngineerMobileLayout from "@/components/layout/EngineerMobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Navigation, CheckCircle, Play, Camera, Image, Upload, X, Loader2, MessageSquare, Save, Trash2, CheckSquare, LayoutGrid, List, Mic, Sparkles, ChevronRight, Briefcase, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import SortablePhotoList from "@/components/photos/SortablePhotoList";
import VoiceNoteRecorder from "@/components/features/VoiceNoteRecorder";
import JobRunSheet from "@/components/engineer/JobRunSheet";
import PartsUsedList from "@/components/engineer/PartsUsedList";
import SosButton from "@/components/engineer/SosButton";
import SlaBadge from "@/components/engineer/SlaBadge";
import SlaDetailsSheet from "@/components/engineer/SlaDetailsSheet";
import SlaTimeline from "@/components/engineer/SlaTimeline";
import QuietHoursButton from "@/components/engineer/QuietHoursButton";
import OverdueEscalationDialog from "@/components/engineer/OverdueEscalationDialog";
import { useEscalationAcks } from "@/hooks/useEscalationAcks";
import { computeSla } from "@/lib/jobSla";
import { AlertTriangle } from "lucide-react";
import { useEngineerSlaAlerts } from "@/hooks/useEngineerSlaAlerts";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type JobStatus = Database["public"]["Enums"]["job_status"];

const statusFlow: Record<string, { next: JobStatus; label: string; icon: typeof Play }> = {
  assigned: { next: "accepted", label: "Accept Job", icon: CheckCircle },
  accepted: { next: "on_the_way", label: "On My Way", icon: Navigation },
  on_the_way: { next: "in_progress", label: "Start Work", icon: Play },
  in_progress: { next: "completed", label: "Complete Job", icon: CheckCircle },
};

const statusColors: Record<string, string> = {
  assigned: "bg-amber-500/10 text-amber-500",
  accepted: "bg-primary/10 text-primary",
  on_the_way: "bg-blue-500/10 text-blue-500",
  in_progress: "bg-green-500/10 text-green-500",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const EngineerJobs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [photoDialogJobId, setPhotoDialogJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobPhotos, setJobPhotos] = useState<Record<string, string[]>>({});
  const [jobAnnotations, setJobAnnotations] = useState<Record<string, Record<string, string>>>({});
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [photoViewMode, setPhotoViewMode] = useState<"list" | "grid">("list");
  const [voiceNoteJobId, setVoiceNoteJobId] = useState<string | null>(null);
  const [escalationJobId, setEscalationJobId] = useState<string | null>(null);

  const { data: engineer } = useQuery({
    queryKey: ["eng-self-jobs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Escalation acknowledgements (persisted in DB via job_events; loaded once
  // engineer id is known and synced in real-time across devices).
  const { isAcked: isEscalationAcked, markAcked: markEscalationAcked } =
    useEscalationAcks(engineer?.id);

  const { data: jobs = [] } = useQuery({
    queryKey: ["eng-my-jobs", engineer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs_engineer_safe")
        .select("*")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!engineer?.id,
  });

  // SmartMatch widget data — recent matches for this engineer
  const { data: smartAlerts = [] } = useQuery({
    queryKey: ["eng-jobs-smart-alerts", engineer?.id],
    queryFn: async () => {
      const { data: alerts } = await supabase
        .from("smart_match_alerts")
        .select("id, created_at, job_id")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false })
        .limit(3);
      const rows = (alerts ?? []) as any[];
      const jobIds = Array.from(new Set(rows.map(r => r.job_id).filter(Boolean)));
      const { data: jobRows } = jobIds.length
        ? await supabase.from("jobs_engineer_safe").select("id, title, location").in("id", jobIds)
        : { data: [] as any[] };
      const byId = new Map((jobRows ?? []).map((j: any) => [j.id, j]));
      return rows.map(r => ({ ...r, jobs: byId.get(r.job_id) ?? null }));
    },
    enabled: !!engineer?.id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["eng-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name, phone");
      return data ?? [];
    },
  });

  // Fetch site surveys for the engineer's jobs to get existing photos
  const { data: surveys = [], refetch: refetchSurveys } = useQuery({
    queryKey: ["eng-job-surveys", engineer?.id],
    queryFn: async () => {
      const jobIds = jobs.map((j) => j.id);
      if (jobIds.length === 0) return [];
      const { data } = await supabase
        .from("site_surveys")
        .select("id, job_id, photos, photo_annotations")
        .in("job_id", jobIds);
      return data ?? [];
    },
    enabled: jobs.length > 0,
  });

  useEffect(() => {
    const photoMap: Record<string, string[]> = {};
    const annotMap: Record<string, Record<string, string>> = {};
    for (const s of surveys) {
      if (s.job_id) {
        photoMap[s.job_id] = Array.isArray(s.photos) ? s.photos : [];
        annotMap[s.job_id] = (s.photo_annotations as Record<string, string>) || {};
      }
    }
    setJobPhotos(photoMap);
    setJobAnnotations(annotMap);
  }, [surveys]);

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  // Real-time subscription for job updates
  useEffect(() => {
    if (!engineer?.id) return;
    const channel = supabase
      .channel("eng-jobs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `engineer_id=eq.${engineer.id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["eng-my-jobs", engineer.id] });
        if (payload.eventType === "INSERT") {
          toast.info("New job assigned to you!");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [engineer?.id, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: JobStatus }) => {
      const startedAt = status === "in_progress" ? new Date().toISOString() : undefined;
      const completedAt = status === "completed" ? new Date().toISOString() : undefined;
      const { error } = await supabase.from("jobs").update({
        status,
        ...(startedAt ? { started_at: startedAt } : {}),
        ...(completedAt ? { completed_at: completedAt } : {}),
      }).eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Job ${status.replace(/_/g, " ")}!`);
      queryClient.invalidateQueries({ queryKey: ["eng-my-jobs"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  const openNavigation = (lat: number | null, lng: number | null, address: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
    }
  };

  const getOrCreateSurvey = async (jobId: string): Promise<string> => {
    // Check if a survey exists for this job
    const existing = surveys.find((s) => s.job_id === jobId);
    if (existing) return existing.id;

    // Find the job to get client_id
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new Error("Job not found");

    const { data, error } = await supabase
      .from("site_surveys")
      .insert({
        client_id: job.client_id,
        job_id: jobId,
        engineer_id: engineer!.id,
        survey_type: "pre_installation",
        status: "in_progress",
        photos: [],
        checklist: [
          { item: "Site access verified", checked: false },
          { item: "Power supply available", checked: false },
          { item: "Network connectivity tested", checked: false },
          { item: "Physical space adequate", checked: false },
          { item: "Safety hazards assessed", checked: false },
          { item: "Photos taken", checked: false },
        ],
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };

  const handlePhotoUpload = async (files: FileList | null, jobId: string) => {
    if (!files || files.length === 0 || !user) return;

    const validFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
    );
    if (validFiles.length === 0) {
      toast.error("Please select valid images (under 10MB)");
      return;
    }

    setUploading(true);
    try {
      const surveyId = await getOrCreateSurvey(jobId);

      const uploadedUrls: string[] = [];
      for (const file of validFiles) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${surveyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("survey-photos").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("survey-photos").getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      // Append to existing photos
      const existingPhotos = jobPhotos[jobId] || [];
      const allPhotos = [...existingPhotos, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from("site_surveys")
        .update({ photos: allPhotos })
        .eq("id", surveyId);
      if (updateError) throw updateError;

      setJobPhotos((prev) => ({ ...prev, [jobId]: allPhotos }));
      refetchSurveys();
      toast.success(`${validFiles.length} photo${validFiles.length > 1 ? "s" : ""} uploaded`);
    } catch (e: any) {
      console.error("Photo upload error:", e);
      toast.error("Failed to upload photos");
    } finally {
      setUploading(false);
    }
  };

  const saveAnnotation = async (photoUrl: string) => {
    if (!photoDialogJobId) return;
    setSavingAnnotation(true);
    try {
      const survey = surveys.find((s) => s.job_id === photoDialogJobId);
      if (!survey) throw new Error("Survey not found");

      const existing = (survey.photo_annotations as Record<string, string>) || {};
      const updated = { ...existing, [photoUrl]: annotationDraft.trim() };
      if (!annotationDraft.trim()) delete updated[photoUrl];

      const { error } = await supabase
        .from("site_surveys")
        .update({ photo_annotations: updated })
        .eq("id", survey.id);
      if (error) throw error;

      setJobAnnotations((prev) => ({ ...prev, [photoDialogJobId]: updated }));
      setEditingAnnotation(null);
      setAnnotationDraft("");
      refetchSurveys();
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingAnnotation(false);
    }
  };

  const deletePhoto = async (photoUrl: string) => {
    if (!photoDialogJobId) return;
    const survey = surveys.find((s) => s.job_id === photoDialogJobId);
    if (!survey) return;
    const updatedPhotos = (survey.photos || []).filter((u: string) => u !== photoUrl);
    const updatedAnnotations = { ...((survey.photo_annotations as Record<string, string>) || {}) };
    delete updatedAnnotations[photoUrl];
    try {
      const { error } = await supabase
        .from("site_surveys")
        .update({ photos: updatedPhotos, photo_annotations: updatedAnnotations })
        .eq("id", survey.id);
      if (error) throw error;
      setJobPhotos((prev) => ({ ...prev, [photoDialogJobId]: updatedPhotos }));
      setJobAnnotations((prev) => ({ ...prev, [photoDialogJobId]: updatedAnnotations }));
      refetchSurveys();
      toast.success("Photo deleted");
    } catch {
      toast.error("Failed to delete photo");
    }
  };

  const bulkDeletePhotos = async () => {
    if (!photoDialogJobId || selectedPhotos.size === 0) return;
    const survey = surveys.find((s) => s.job_id === photoDialogJobId);
    if (!survey) return;
    const updatedPhotos = (survey.photos || []).filter((u: string) => !selectedPhotos.has(u));
    const updatedAnnotations = { ...((survey.photo_annotations as Record<string, string>) || {}) };
    selectedPhotos.forEach((url) => delete updatedAnnotations[url]);
    try {
      const { error } = await supabase
        .from("site_surveys")
        .update({ photos: updatedPhotos, photo_annotations: updatedAnnotations })
        .eq("id", survey.id);
      if (error) throw error;
      setJobPhotos((prev) => ({ ...prev, [photoDialogJobId]: updatedPhotos }));
      setJobAnnotations((prev) => ({ ...prev, [photoDialogJobId]: updatedAnnotations }));
      setSelectedPhotos(new Set());
      setBulkSelectMode(false);
      refetchSurveys();
      toast.success(`${selectedPhotos.size} photo${selectedPhotos.size > 1 ? "s" : ""} deleted`);
    } catch {
      toast.error("Failed to delete photos");
    }
  };

  const handleReorderPhotos = async (newOrder: string[]) => {
    if (!photoDialogJobId) return;
    const survey = surveys.find((s) => s.job_id === photoDialogJobId);
    if (!survey) return;
    setJobPhotos((prev) => ({ ...prev, [photoDialogJobId]: newOrder }));
    try {
      const { error } = await supabase
        .from("site_surveys")
        .update({ photos: newOrder })
        .eq("id", survey.id);
      if (error) throw error;
      refetchSurveys();
    } catch {
      toast.error("Failed to reorder photos");
    }
  };

  const activeJobs = jobs.filter((j) => !["completed", "cancelled"].includes(j.status));
  const pastJobs = jobs.filter((j) => ["completed", "cancelled"].includes(j.status));

  // SLA tracking + dispatch alerts for active jobs
  useEngineerSlaAlerts(activeJobs as any, engineer?.id ?? null);

  const currentPhotos = photoDialogJobId ? jobPhotos[photoDialogJobId] || [] : [];
  const currentAnnotations = photoDialogJobId ? jobAnnotations[photoDialogJobId] || {} : {};

  return (
    <EngineerMobileLayout title="My Jobs">
      <div className="space-y-5">
        {/* Quick widgets — surfaced on dashboard landing */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Pending</p>
                <p className="text-base font-bold text-foreground leading-tight">
                  {jobs.filter((j) => j.status === "assigned").length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Play className="w-4 h-4 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">In progress</p>
                <p className="text-base font-bold text-foreground leading-tight">
                  {jobs.filter((j) => j.status === "in_progress").length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className="text-base font-bold text-foreground leading-tight">{jobs.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Link to="/engineer/smart-match" className="block group">
          <Card className="hover:border-primary/40 hover:shadow-md transition">
            <CardContent className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">SmartMatch Alerts</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {smartAlerts.length > 0
                        ? `${smartAlerts.length} recent match${smartAlerts.length === 1 ? "" : "es"} · ${(smartAlerts[0]?.jobs as any)?.title ?? "Job match"}`
                        : "Set up saved searches to get notified of matching jobs"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (photoDialogJobId) handlePhotoUpload(e.target.files, photoDialogJobId);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (photoDialogJobId) handlePhotoUpload(e.target.files, photoDialogJobId);
            e.target.value = "";
          }}
        />

        {/* Photo Gallery Dialog */}
        <Dialog open={!!photoDialogJobId} onOpenChange={(open) => { if (!open) { setPhotoDialogJobId(null); setBulkSelectMode(false); setSelectedPhotos(new Set()); } }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" /> Site Photos
                {currentPhotos.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">({currentPhotos.length})</span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1"
                  disabled={uploading}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  <span className="text-xs">Take Photo</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1"
                  disabled={uploading}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  <span className="text-xs">From Gallery</span>
                </Button>
              </div>

              {/* Toolbar */}
              {currentPhotos.length > 0 && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    {currentPhotos.length > 1 && (
                      <Button
                        variant={bulkSelectMode ? "secondary" : "ghost"}
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => { setBulkSelectMode(!bulkSelectMode); setSelectedPhotos(new Set()); }}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        {bulkSelectMode ? "Cancel" : "Select"}
                      </Button>
                    )}
                    {bulkSelectMode && (
                      <>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                          if (selectedPhotos.size === currentPhotos.length) setSelectedPhotos(new Set());
                          else setSelectedPhotos(new Set(currentPhotos));
                        }}>
                          {selectedPhotos.size === currentPhotos.length ? "Deselect All" : "Select All"}
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-1 text-xs" disabled={selectedPhotos.size === 0} onClick={() => setBulkDeleteConfirm(true)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedPhotos.size})
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button
                      className={`p-1.5 transition-colors ${photoViewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setPhotoViewMode("list")}
                    ><List className="w-4 h-4" /></button>
                    <button
                      className={`p-1.5 transition-colors ${photoViewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setPhotoViewMode("grid")}
                    ><LayoutGrid className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              {/* Photo display */}
              {currentPhotos.length > 0 ? (
                photoViewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {currentPhotos.map((url, i) => (
                      <div
                        key={url}
                        className={`relative group rounded-lg border overflow-hidden aspect-square ${bulkSelectMode && selectedPhotos.has(url) ? "ring-2 ring-primary" : ""}`}
                        onClick={bulkSelectMode ? () => {
                          setSelectedPhotos((prev) => {
                            const next = new Set(prev);
                            if (next.has(url)) next.delete(url); else next.add(url);
                            return next;
                          });
                        } : undefined}
                      >
                        {!bulkSelectMode ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full">
                            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                          </a>
                        ) : (
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover cursor-pointer" />
                        )}
                        {bulkSelectMode && (
                          <div className="absolute top-1 left-1">
                            <Checkbox checked={selectedPhotos.has(url)} className="h-4 w-4 border-2 border-background bg-background/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                          </div>
                        )}
                        {!bulkSelectMode && (
                          <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setPhotoToDelete(url); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                        {currentAnnotations[url] && (
                          <div className="absolute bottom-0 inset-x-0 bg-background/80 px-1 py-0.5">
                            <p className="text-[10px] text-foreground truncate">{currentAnnotations[url]}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <SortablePhotoList
                    photos={currentPhotos}
                    onReorder={handleReorderPhotos}
                    disabled={bulkSelectMode}
                    renderItem={(url, i, dragHandle) => {
                      const annotation = currentAnnotations[url] || "";
                      const isEditing = editingAnnotation === url;
                      return (
                        <div className={`rounded-lg border overflow-hidden ${bulkSelectMode && selectedPhotos.has(url) ? "ring-2 ring-primary" : ""}`}>
                          <div className="relative group cursor-pointer" onClick={bulkSelectMode ? () => { setSelectedPhotos((prev) => { const next = new Set(prev); if (next.has(url)) next.delete(url); else next.add(url); return next; }); } : undefined}>
                            {dragHandle}
                            {!bulkSelectMode ? (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={`Site photo ${i + 1}`} className="w-full h-40 object-cover hover:opacity-90 transition-opacity" />
                              </a>
                            ) : (
                              <img src={url} alt={`Site photo ${i + 1}`} className="w-full h-40 object-cover hover:opacity-90 transition-opacity" />
                            )}
                            {bulkSelectMode && <div className="absolute top-2 left-2"><Checkbox checked={selectedPhotos.has(url)} className="h-5 w-5 border-2 border-background bg-background/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary" /></div>}
                            {!bulkSelectMode && <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setPhotoToDelete(url); }}><Trash2 className="w-3.5 h-3.5" /></Button>}
                          </div>
                          <div className="p-2 bg-muted/30">
                            {isEditing ? (
                              <div className="space-y-2">
                                <Textarea value={annotationDraft} onChange={(e) => setAnnotationDraft(e.target.value)} placeholder="Add a note about this photo..." className="text-xs min-h-[60px] resize-none" maxLength={500} />
                                <div className="flex gap-1.5 justify-end">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingAnnotation(null); setAnnotationDraft(""); }}>Cancel</Button>
                                  <Button size="sm" className="h-7 text-xs gap-1" disabled={savingAnnotation} onClick={() => saveAnnotation(url)}>
                                    {savingAnnotation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingAnnotation(url); setAnnotationDraft(annotation); }} className="w-full text-left flex items-start gap-1.5 group">
                                <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                                {annotation ? <span className="text-xs text-foreground">{annotation}</span> : <span className="text-xs text-muted-foreground italic group-hover:text-foreground transition-colors">Add a note...</span>}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                )
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No photos yet — take or upload some!
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Photo Confirmation */}
        <AlertDialog open={!!photoToDelete} onOpenChange={(open) => { if (!open) setPhotoToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete photo?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove the photo and its annotation. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { if (photoToDelete) { deletePhoto(photoToDelete); setPhotoToDelete(null); } }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedPhotos.size} photo{selectedPhotos.size > 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove the selected photos and their annotations. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { bulkDeletePhotos(); setBulkDeleteConfirm(false); }}
              >
                Delete {selectedPhotos.size} Photo{selectedPhotos.size > 1 ? "s" : ""}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground">Active Jobs ({activeJobs.length})</h3>
            <QuietHoursButton />
          </div>
          {activeJobs.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No active jobs right now 🎉
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {activeJobs.map((job) => {
              const client = clientMap.get(job.client_id);
              const flow = statusFlow[job.status];
              const photoCount = (jobPhotos[job.id] || []).length;
              // Gate the next-step action when SLA is overdue and not yet escalated.
              const sla = computeSla(job as any);
              const overdueLocked = sla.state === "overdue" && !isEscalationAcked(job.id);
              return (
                <Card key={job.id} className={job.status === "assigned" ? "border-amber-500/40" : ""}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{job.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{job.service_type}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize whitespace-nowrap ${statusColors[job.status]}`}>
                          {job.status.replace(/_/g, " ")}
                        </span>
                        <SlaDetailsSheet job={job as any} />
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                      {client && (
                        <p className="text-xs text-muted-foreground">Client: <span className="text-foreground font-medium">{client.company_name}</span></p>
                      )}
                      {job.scheduled_at && (
                        <p className="text-xs text-muted-foreground">
                          Scheduled: {new Date(job.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                      {job.priority === "urgent" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive uppercase">Urgent</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {overdueLocked ? (
                        <button
                          onClick={() => setEscalationJobId(job.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity animate-pulse"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Resolve SLA escalation
                        </button>
                      ) : (
                        flow && (
                          <button
                            onClick={() => updateStatusMutation.mutate({ jobId: job.id, status: flow.next })}
                            disabled={updateStatusMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            <flow.icon className="w-4 h-4" />
                            {flow.label}
                          </button>
                        )
                      )}
                      <button
                        onClick={() => setPhotoDialogJobId(job.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity relative"
                      >
                        <Camera className="w-4 h-4" />
                        {photoCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                            {photoCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => openNavigation(job.latitude, job.longitude, job.location)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <Navigation className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setVoiceNoteJobId(voiceNoteJobId === job.id ? null : job.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Voice Note Recorder */}
                    {voiceNoteJobId === job.id && (
                      <VoiceNoteRecorder
                        jobId={job.id}
                        onTranscript={(transcript, summary) => {
                          toast.success("Voice note saved with AI summary");
                        }}
                      />
                    )}

                    {/* SLA escalation timeline */}
                    <SlaTimeline job={job as any} />

                    {/* Field tools — clock in/out, parts used, SOS */}
                    {engineer?.id && (job.status === "in_progress" || job.status === "on_the_way" || job.status === "accepted") && (
                      <div className="space-y-2 pt-1">
                        <JobRunSheet jobId={job.id} engineerId={engineer.id} />
                        <PartsUsedList jobId={job.id} engineerId={engineer.id} />
                        <div className="flex justify-end">
                          <SosButton engineerId={engineer.id} jobId={job.id} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Past Jobs */}
        {pastJobs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Past Jobs ({pastJobs.length})</h3>
            <div className="space-y-2">
              {pastJobs.slice(0, 10).map((job) => (
                <Card key={job.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.service_type} · {job.completed_at ? new Date(job.completed_at).toLocaleDateString() : ""}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColors[job.status]}`}>
                      {job.status}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {escalationJobId && engineer?.id && (() => {
        const job = activeJobs.find((j) => j.id === escalationJobId);
        if (!job) return null;
        return (
          <OverdueEscalationDialog
            open
            onOpenChange={(v) => !v && setEscalationJobId(null)}
            jobId={job.id}
            jobTitle={job.title}
            engineerId={engineer.id}
            scheduledAt={job.scheduled_at}
            onAcknowledged={() => markEscalationAcked(job.id)}
          />
        );
      })()}
    </EngineerMobileLayout>
  );
};

export default EngineerJobs;
