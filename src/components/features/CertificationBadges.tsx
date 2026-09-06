import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Plus, Clock, CheckCircle2, XCircle, Upload, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CertificationBadgesProps {
  engineerId: string;
  canManage?: boolean;
}

type CertStatus = "pending" | "verified" | "rejected" | "expired";

const statusConfig: Record<CertStatus, { label: string; className: string; icon: any }> = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  verified: { label: "Verified", className: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground border-border", icon: AlertTriangle },
};

const CertificationBadges = ({ engineerId, canManage = false }: CertificationBadgesProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docPath, setDocPath] = useState<string | null>(null);

  const { data: types } = useQuery({
    queryKey: ["cert-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certification_types")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: certs, isLoading } = useQuery({
    queryKey: ["engineer-certs", engineerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_certifications")
        .select("*, certification_types(*)")
        .eq("engineer_id", engineerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!engineerId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTypeId) throw new Error("Choose a certification type");
      const { error } = await supabase.from("engineer_certifications").insert({
        engineer_id: engineerId,
        certification_type_id: selectedTypeId,
        issued_date: issuedDate || null,
        expiry_date: expiryDate || null,
        certificate_number: certNumber || null,
        notes: notes || null,
        document_url: docPath,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certification submitted for verification");
      queryClient.invalidateQueries({ queryKey: ["engineer-certs", engineerId] });
      setOpen(false);
      setSelectedTypeId(""); setIssuedDate(""); setExpiryDate("");
      setCertNumber(""); setNotes(""); setDocPath(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: CertStatus; reason?: string }) => {
      const { error } = await supabase
        .from("engineer_certifications")
        .update({
          status,
          verified_at: status === "verified" ? new Date().toISOString() : null,
          verified_by: status === "verified" ? user?.id : null,
          rejection_reason: status === "rejected" ? reason : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      queryClient.invalidateQueries({ queryKey: ["engineer-certs", engineerId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("certification-documents").upload(path, file);
      if (error) throw error;
      setDocPath(path);
      toast.success("Document uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const isExpired = (d: string | null) => d && new Date(d) < new Date();
  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days > 0 && days < 60;
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Certifications & Badges
          {certs && <Badge variant="secondary" className="ml-2">{certs.filter((c: any) => c.status === "verified").length}</Badge>}
        </CardTitle>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Add</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add certification</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Certification</Label>
                  <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                    <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {types?.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} {t.issuer && <span className="text-muted-foreground">· {t.issuer}</span>}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Issued</Label><Input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} /></div>
                  <div><Label>Expires</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
                </div>
                <div><Label>Certificate # (optional)</Label><Input value={certNumber} onChange={e => setCertNumber(e.target.value)} /></div>
                <div>
                  <Label>Document (PDF / image)</Label>
                  <div className="flex gap-2 items-center">
                    <Input ref={fileInputRef} type="file" accept="application/pdf,image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} disabled={uploading} />
                    {docPath && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                  </div>
                </div>
                <div><Label>Notes (optional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !selectedTypeId}>
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !certs?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No certifications yet.</p>
        ) : (
          <div className="space-y-2">
            {certs.map((c: any) => {
              const status = (isExpired(c.expiry_date) ? "expired" : c.status) as CertStatus;
              const cfg = statusConfig[status];
              const Icon = cfg.icon;
              return (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("p-2 rounded-md shrink-0", cfg.className)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.certification_types?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.certification_types?.issuer}
                        {c.expiry_date && (
                          <span className={cn("ml-2", isExpired(c.expiry_date) && "text-destructive font-semibold", isExpiringSoon(c.expiry_date) && "text-warning font-semibold")}>
                            · expires {new Date(c.expiry_date).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.document_url && <FileText className="w-4 h-4 text-muted-foreground" />}
                    <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                    {canManage && c.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => verifyMutation.mutate({ id: c.id, status: "verified" })}><CheckCircle2 className="w-4 h-4 text-success" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => verifyMutation.mutate({ id: c.id, status: "rejected", reason: "Document unclear" })}><XCircle className="w-4 h-4 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CertificationBadges;
