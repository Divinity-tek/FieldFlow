import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Plus, ClipboardList, Trash2, CheckSquare, Settings } from "lucide-react";
import { format } from "date-fns";

interface FormField {
  id: string; label: string; type: string; required: boolean; options?: string[];
}

const CustomForms = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("inspection");
  const [formDescription, setFormDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);

  const { data: templates = [] } = useQuery({
    queryKey: ["form_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["form_submissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_submissions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addField = () => {
    setFields([...fields, { id: crypto.randomUUID(), label: "", type: "text", required: false }]);
  };

  const updateField = (id: string, key: string, value: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeField = (id: string) => setFields(fields.filter(f => f.id !== id));

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("form_templates").insert({
        name: formName, category: formCategory, description: formDescription,
        fields: fields as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form_templates"] });
      toast.success("Form template created");
      setDialogOpen(false);
      setFormName(""); setFields([]); setFormDescription("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categoryColors: Record<string, string> = {
    inspection: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    safety: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    maintenance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    checklist: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    survey: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <AppLayout title="Forms & Checklists">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Forms & Checklists</h1>
            <p className="text-muted-foreground text-sm">Create custom inspection forms, safety checklists & field templates</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Create Template</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Form Template</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Template Name</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Safety Inspection Form" /></div>
                  <div><Label>Category</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inspection">Inspection</SelectItem>
                        <SelectItem value="safety">Safety</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="checklist">Checklist</SelectItem>
                        <SelectItem value="survey">Survey</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Description</Label><Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} /></div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Form Fields</h3>
                    <Button variant="outline" size="sm" onClick={addField} className="gap-1"><Plus className="w-3 h-3" /> Add Field</Button>
                  </div>
                  {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No fields added yet. Click "Add Field" to start building your form.</p>}
                  {fields.map((field, i) => (
                    <div key={field.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                      <Input className="flex-1" placeholder="Field label" value={field.label} onChange={e => updateField(field.id, "label", e.target.value)} />
                      <Select value={field.type} onValueChange={v => updateField(field.id, "type", v)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                          <SelectItem value="textarea">Long Text</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="photo">Photo</SelectItem>
                          <SelectItem value="signature">Signature</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, "required", e.target.checked)} /> Req
                      </label>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeField(field.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button onClick={() => createTemplate.mutate()} disabled={!formName || fields.length === 0}>Create Template</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Templates", value: templates.length, icon: FileText, color: "text-blue-600" },
            { label: "Submissions", value: submissions.length, icon: ClipboardList, color: "text-emerald-600" },
            { label: "Completed", value: submissions.filter((s: any) => s.status === "completed").length, icon: CheckSquare, color: "text-purple-600" },
            { label: "Categories", value: new Set(templates.map((t: any) => t.category)).size, icon: Settings, color: "text-amber-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`}><s.icon className="w-5 h-5" /></div>
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="templates">
          <TabsList><TabsTrigger value="templates">Templates</TabsTrigger><TabsTrigger value="submissions">Submissions</TabsTrigger></TabsList>
          <TabsContent value="templates">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.length === 0 ? (
                <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">No templates yet. Create your first form template.</CardContent></Card>
              ) : templates.map((t: any) => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <Badge className={categoryColors[t.category] || ""}>{t.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {t.description && <p className="text-sm text-muted-foreground mb-2">{t.description}</p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{(t.fields as any[])?.length || 0} fields</span>
                      <span>{format(new Date(t.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="submissions">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No submissions yet</TableCell></TableRow>
                    ) : submissions.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.template_id.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                        <TableCell>{s.submitted_at ? format(new Date(s.submitted_at), "MMM d, yyyy") : "Draft"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CustomForms;
