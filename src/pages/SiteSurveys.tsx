import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, Plus, Search, FileCheck, Clock, AlertCircle, Camera, Image, Upload, X, Loader2, MessageSquare, Trash2, CheckSquare, LayoutGrid, List } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import SortablePhotoList from "@/components/photos/SortablePhotoList";
import { toast } from "sonner";
import AskAIButton from "@/components/ai/AskAIButton";

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
};

const surveyTypes = ["pre_installation", "post_installation", "maintenance", "audit", "network_assessment"];

const SiteSurveys = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [previewPhotos, setPreviewPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ client_id: "", job_id: "", survey_type: "pre_installation", findings: "", recommendations: "" });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photoToDelete, setPhotoToDelete] = useState<{ url: string; index: number } | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [photoViewMode, setPhotoViewMode] = useState<"list" | "grid">("list");

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["site-surveys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_surveys").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data || [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id, title");
      return data || [];
    },
  });

  const uploadPhotos = async (surveyId: string, files: File[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const uploadedUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${surveyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("survey-photos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("survey-photos").getPublicUrl(path);
      uploadedUrls.push(urlData.publicUrl);
    }
    return uploadedUrls;
  };

  const createMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { data, error } = await supabase.from("site_surveys").insert({
        client_id: f.client_id,
        job_id: f.job_id || null,
        survey_type: f.survey_type,
        findings: f.findings || null,
        recommendations: f.recommendations || null,
        photos: [],
        checklist: [
          { item: "Site access verified", checked: false },
          { item: "Power supply available", checked: false },
          { item: "Network connectivity tested", checked: false },
          { item: "Physical space adequate", checked: false },
          { item: "Safety hazards assessed", checked: false },
          { item: "Equipment mounting points identified", checked: false },
          { item: "Cable routing planned", checked: false },
          { item: "Photos taken", checked: false },
        ],
      }).select().single();
      if (error) throw error;

      if (pendingFiles.length > 0 && data) {
        const urls = await uploadPhotos(data.id, pendingFiles);
        const { error: updateError } = await supabase
          .from("site_surveys")
          .update({ photos: urls })
          .eq("id", data.id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-surveys"] });
      toast.success("Survey created");
      setDialogOpen(false);
      setForm({ client_id: "", job_id: "", survey_type: "pre_installation", findings: "", recommendations: "" });
      setPendingFiles([]);
    },
    onError: () => toast.error("Failed to create survey"),
  });

  const uploadToExistingMutation = useMutation({
    mutationFn: async ({ surveyId, files }: { surveyId: string; files: File[] }) => {
      setUploading(true);
      const urls = await uploadPhotos(surveyId, files);
      const existing = selectedSurvey?.photos || [];
      const allPhotos = [...existing, ...urls];
      const { error } = await supabase
        .from("site_surveys")
        .update({ photos: allPhotos })
        .eq("id", surveyId);
      if (error) throw error;
      return allPhotos;
    },
    onSuccess: (allPhotos) => {
      queryClient.invalidateQueries({ queryKey: ["site-surveys"] });
      setSelectedSurvey((prev: any) => prev ? { ...prev, photos: allPhotos } : prev);
      toast.success("Photos uploaded");
      setUploading(false);
    },
    onError: () => {
      toast.error("Failed to upload photos");
      setUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, forExisting = false) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      toast.error("Some files were skipped (must be images under 10MB)");
    }
    if (forExisting && selectedSurvey) {
      uploadToExistingMutation.mutate({ surveyId: selectedSurvey.id, files: validFiles });
    } else {
      setPendingFiles(prev => [...prev, ...validFiles]);
    }
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openPhotoDialog = (survey: any) => {
    setSelectedSurvey(survey);
    setPreviewPhotos(survey.photos || []);
    setPhotoDialogOpen(true);
  };

  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.company_name]));
  const jobMap = Object.fromEntries(jobs.map((j: any) => [j.id, j.title]));

  const filtered = surveys.filter((s: any) => {
    const clientName = clientMap[s.client_id] || "";
    return clientName.toLowerCase().includes(search.toLowerCase()) || s.survey_type.includes(search.toLowerCase());
  });

  const completed = surveys.filter((s: any) => s.status === "completed").length;
  const inProgress = surveys.filter((s: any) => s.status === "in_progress").length;
  const drafts = surveys.filter((s: any) => s.status === "draft").length;

  return (
    <AppLayout title="Site Surveys & Assessments" subtitle="Pre-job site surveys with checklists and findings">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><ClipboardCheck className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold">{surveys.length}</p><p className="text-xs text-muted-foreground">Total Surveys</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center"><FileCheck className="w-5 h-5 text-green-500" /></div><div><p className="text-2xl font-bold">{completed}</p><p className="text-xs text-muted-foreground">Completed</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{inProgress}</p><p className="text-xs text-muted-foreground">In Progress</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-gray-500" /></div><div><p className="text-2xl font-bold">{drafts}</p><p className="text-xs text-muted-foreground">Drafts</p></div></div></CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search surveys..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setPendingFiles([]); }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Survey</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Site Survey</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Client *</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Job (optional)</Label>
                  <Select value={form.job_id} onValueChange={v => setForm({...form, job_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Link to job" /></SelectTrigger>
                    <SelectContent>{jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Survey Type</Label>
                  <Select value={form.survey_type} onValueChange={v => setForm({...form, survey_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{surveyTypes.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Initial Findings</Label><Textarea value={form.findings} onChange={e => setForm({...form, findings: e.target.value})} /></div>
                <div><Label>Recommendations</Label><Textarea value={form.recommendations} onChange={e => setForm({...form, recommendations: e.target.value})} /></div>

                {/* Photo Upload Section */}
                <div>
                  <Label className="flex items-center gap-1.5 mb-2"><Camera className="w-4 h-4" /> Site Photos</Label>
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">Click to upload photos</p>
                    <p className="text-xs text-muted-foreground/70">Images up to 10MB each</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e)}
                  />
                  {pendingFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {pendingFiles.map((file, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-20 object-cover rounded-md border"
                          />
                          <button
                            onClick={() => removePendingFile(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={() => createMutation.mutate(form)} disabled={!form.client_id || createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : `Create Survey${pendingFiles.length ? ` (${pendingFiles.length} photos)` : ""}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <AskAIButton prompt="Analyze site survey trends, common findings, and recommendations for improving pre-installation processes." label="AI Analysis" />
        </div>

        {/* Photo Viewer Dialog */}
        <Dialog open={photoDialogOpen} onOpenChange={(open) => { setPhotoDialogOpen(open); if (!open) { setBulkSelectMode(false); setSelectedPhotos(new Set()); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" /> Survey Photos
                {selectedSurvey && <Badge variant="outline" className="ml-2">{(selectedSurvey.photos || []).length} photos</Badge>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Toolbar */}
              {selectedSurvey?.photos?.length > 0 && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    {(selectedSurvey?.photos?.length ?? 0) > 1 && (
                      <Button variant={bulkSelectMode ? "secondary" : "ghost"} size="sm" className="gap-1.5 text-xs" onClick={() => { setBulkSelectMode(!bulkSelectMode); setSelectedPhotos(new Set()); }}>
                        <CheckSquare className="w-3.5 h-3.5" />
                        {bulkSelectMode ? "Cancel" : "Select"}
                      </Button>
                    )}
                    {bulkSelectMode && (
                      <>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                          const allUrls = selectedSurvey.photos as string[];
                          if (selectedPhotos.size === allUrls.length) setSelectedPhotos(new Set());
                          else setSelectedPhotos(new Set(allUrls));
                        }}>
                          {selectedPhotos.size === (selectedSurvey.photos as string[]).length ? "Deselect All" : "Select All"}
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-1 text-xs" disabled={selectedPhotos.size === 0} onClick={() => setBulkDeleteConfirm(true)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedPhotos.size})
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button className={`p-1.5 transition-colors ${photoViewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setPhotoViewMode("list")}><List className="w-4 h-4" /></button>
                    <button className={`p-1.5 transition-colors ${photoViewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setPhotoViewMode("grid")}><LayoutGrid className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              {selectedSurvey?.photos?.length > 0 ? (
                photoViewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedSurvey.photos as string[]).map((url: string, i: number) => {
                      const annotations = (selectedSurvey.photo_annotations as Record<string, string>) || {};
                      const note = annotations[url];
                      return (
                        <div
                          key={url}
                          className={`relative group rounded-lg border overflow-hidden aspect-square ${bulkSelectMode && selectedPhotos.has(url) ? "ring-2 ring-primary" : ""}`}
                          onClick={bulkSelectMode ? () => { setSelectedPhotos((prev) => { const next = new Set(prev); if (next.has(url)) next.delete(url); else next.add(url); return next; }); } : undefined}
                        >
                          {!bulkSelectMode ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full">
                              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                            </a>
                          ) : (
                            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover cursor-pointer" />
                          )}
                          {bulkSelectMode && <div className="absolute top-1 left-1"><Checkbox checked={selectedPhotos.has(url)} className="h-4 w-4 border-2 border-background bg-background/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary" /></div>}
                          {!bulkSelectMode && <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setPhotoToDelete({ url, index: i }); }}><Trash2 className="w-3 h-3" /></Button>}
                          {note && <div className="absolute bottom-0 inset-x-0 bg-background/80 px-1 py-0.5"><p className="text-[10px] text-foreground truncate">{note}</p></div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <SortablePhotoList
                    photos={selectedSurvey.photos as string[]}
                    disabled={bulkSelectMode}
                    onReorder={async (newOrder) => {
                      setSelectedSurvey({ ...selectedSurvey, photos: newOrder });
                      const { error } = await supabase.from("site_surveys").update({ photos: newOrder }).eq("id", selectedSurvey.id);
                      if (error) toast.error("Failed to reorder photos");
                      else queryClient.invalidateQueries({ queryKey: ["site-surveys"] });
                    }}
                    renderItem={(url, i, dragHandle) => {
                      const annotations = (selectedSurvey.photo_annotations as Record<string, string>) || {};
                      const note = annotations[url];
                      return (
                        <div className={`rounded-lg border overflow-hidden ${bulkSelectMode && selectedPhotos.has(url) ? "ring-2 ring-primary" : ""}`}>
                          <div className="relative group cursor-pointer" onClick={bulkSelectMode ? () => { setSelectedPhotos((prev) => { const next = new Set(prev); if (next.has(url)) next.delete(url); else next.add(url); return next; }); } : undefined}>
                            {dragHandle}
                            {!bulkSelectMode ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                <img src={url} alt={`Survey photo ${i + 1}`} className="w-full h-48 object-cover hover:opacity-90 transition-opacity cursor-pointer" />
                              </a>
                            ) : (
                              <img src={url} alt={`Survey photo ${i + 1}`} className="w-full h-48 object-cover hover:opacity-90 transition-opacity cursor-pointer" />
                            )}
                            {bulkSelectMode && <div className="absolute top-2 left-2"><Checkbox checked={selectedPhotos.has(url)} className="h-5 w-5 border-2 border-background bg-background/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary" /></div>}
                            {!bulkSelectMode && <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setPhotoToDelete({ url, index: i }); }}><Trash2 className="w-3.5 h-3.5" /></Button>}
                          </div>
                          {note && (
                            <div className="px-3 py-2 bg-muted/30 flex items-start gap-2">
                              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                              <p className="text-xs text-foreground">{note}</p>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                )
              ) : (
                <p className="text-center text-muted-foreground py-8">No photos uploaded yet</p>
              )}

              <div className="border-t pt-3">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  id="existing-survey-upload"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, true)}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                  onClick={() => document.getElementById("existing-survey-upload")?.click()}
                >
                  {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-1" /> Add More Photos</>}
                </Button>
              </div>
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
                onClick={async () => {
                  if (!photoToDelete || !selectedSurvey) return;
                  const updatedPhotos = selectedSurvey.photos.filter((_: string, idx: number) => idx !== photoToDelete.index);
                  const annots = (selectedSurvey.photo_annotations as Record<string, string>) || {};
                  const updatedAnnotations = { ...annots };
                  delete updatedAnnotations[photoToDelete.url];
                  const { error } = await supabase
                    .from("site_surveys")
                    .update({ photos: updatedPhotos, photo_annotations: updatedAnnotations })
                    .eq("id", selectedSurvey.id);
                  if (error) { toast.error("Failed to delete photo"); return; }
                  queryClient.invalidateQueries({ queryKey: ["site-surveys"] });
                  setSelectedSurvey({ ...selectedSurvey, photos: updatedPhotos, photo_annotations: updatedAnnotations });
                  setPhotoToDelete(null);
                  toast.success("Photo deleted");
                }}
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
                onClick={async () => {
                  if (!selectedSurvey || selectedPhotos.size === 0) return;
                  const updatedPhotos = (selectedSurvey.photos as string[]).filter((u: string) => !selectedPhotos.has(u));
                  const annots = (selectedSurvey.photo_annotations as Record<string, string>) || {};
                  const updatedAnnotations = { ...annots };
                  selectedPhotos.forEach((url) => delete updatedAnnotations[url]);
                  const { error } = await supabase
                    .from("site_surveys")
                    .update({ photos: updatedPhotos, photo_annotations: updatedAnnotations })
                    .eq("id", selectedSurvey.id);
                  if (error) { toast.error("Failed to delete photos"); return; }
                  queryClient.invalidateQueries({ queryKey: ["site-surveys"] });
                  setSelectedSurvey({ ...selectedSurvey, photos: updatedPhotos, photo_annotations: updatedAnnotations });
                  setSelectedPhotos(new Set());
                  setBulkSelectMode(false);
                  setBulkDeleteConfirm(false);
                  toast.success(`${selectedPhotos.size} photo${selectedPhotos.size > 1 ? "s" : ""} deleted`);
                }}
              >
                Delete {selectedPhotos.size} Photo{selectedPhotos.size > 1 ? "s" : ""}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Photos</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No surveys found</TableCell></TableRow>
                ) : filtered.map((s: any) => {
                  const checklist = Array.isArray(s.checklist) ? s.checklist : [];
                  const checkedCount = checklist.filter((c: any) => c.checked).length;
                  const photoCount = Array.isArray(s.photos) ? s.photos.length : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{clientMap[s.client_id] || "Unknown"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.job_id ? jobMap[s.job_id] || "—" : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{s.survey_type.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={statusColors[s.status] || ""}>{s.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => openPhotoDialog(s)}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {photoCount}
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{checkedCount}/{checklist.length}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SiteSurveys;
