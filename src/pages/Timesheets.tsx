import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, Plus, CheckCircle, DollarSign, Timer, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const Timesheets = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    engineer_id: "", date: "", clock_in: "", clock_out: "", break_minutes: "0", hourly_rate: "35", notes: "",
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ["timesheets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheets").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["engineers_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("engineers").select("id, specialty, user_id");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const clockIn = new Date(`${form.date}T${form.clock_in}`);
      const clockOut = new Date(`${form.date}T${form.clock_out}`);
      const diffMs = clockOut.getTime() - clockIn.getTime();
      const totalHours = Math.max(0, (diffMs / 3600000) - (parseInt(form.break_minutes) || 0) / 60);
      const overtime = Math.max(0, totalHours - 8);
      const rate = parseFloat(form.hourly_rate) || 0;
      const totalPay = (Math.min(totalHours, 8) * rate) + (overtime * rate * 1.5);

      const { error } = await supabase.from("timesheets").insert({
        engineer_id: form.engineer_id, date: form.date,
        clock_in: clockIn.toISOString(), clock_out: clockOut.toISOString(),
        break_minutes: parseInt(form.break_minutes) || 0,
        total_hours: Math.round(totalHours * 100) / 100,
        overtime_hours: Math.round(overtime * 100) / 100,
        hourly_rate: rate, total_pay: Math.round(totalPay * 100) / 100,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      toast.success("Timesheet entry created");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timesheets").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      toast.success("Timesheet approved");
    },
  });

  const filtered = filter === "all" ? timesheets : timesheets.filter((t: any) => t.status === filter);
  const totalHours = timesheets.reduce((s: number, t: any) => s + Number(t.total_hours), 0);
  const totalPay = timesheets.reduce((s: number, t: any) => s + Number(t.total_pay), 0);
  const totalOT = timesheets.reduce((s: number, t: any) => s + Number(t.overtime_hours), 0);

  return (
    <AppLayout title="Timesheets">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Timesheets & Payroll</h1>
            <p className="text-muted-foreground text-sm">Track engineer hours, overtime & payroll</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Log Hours</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log Timesheet Entry</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div><Label>Engineer</Label>
                  <Select value={form.engineer_id} onValueChange={v => setForm({...form, engineer_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
                    <SelectContent>{engineers.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.specialty} ({e.id.slice(0,8)})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Clock In</Label><Input type="time" value={form.clock_in} onChange={e => setForm({...form, clock_in: e.target.value})} /></div>
                  <div><Label>Clock Out</Label><Input type="time" value={form.clock_out} onChange={e => setForm({...form, clock_out: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Break (min)</Label><Input type="number" value={form.break_minutes} onChange={e => setForm({...form, break_minutes: e.target.value})} /></div>
                  <div><Label>Hourly Rate ($)</Label><Input type="number" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: e.target.value})} /></div>
                </div>
                <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.engineer_id || !form.date || !form.clock_in || !form.clock_out}>Submit Entry</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Hours", value: totalHours.toFixed(1), icon: Clock, color: "text-blue-600" },
            { label: "Overtime Hours", value: totalOT.toFixed(1), icon: AlertTriangle, color: "text-amber-600" },
            { label: "Total Payroll", value: `$${totalPay.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600" },
            { label: "Pending Approval", value: timesheets.filter((t: any) => t.status === "pending").length, icon: Timer, color: "text-orange-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`}><s.icon className="w-5 h-5" /></div>
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Engineer</TableHead><TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead><TableHead>Break</TableHead><TableHead>Hours</TableHead>
                  <TableHead>OT</TableHead><TableHead>Pay</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No timesheet entries</TableCell></TableRow>
                ) : filtered.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{format(new Date(t.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{t.engineer_id.slice(0, 8)}</TableCell>
                    <TableCell>{t.clock_in && format(new Date(t.clock_in), "h:mm a")}</TableCell>
                    <TableCell>{t.clock_out && format(new Date(t.clock_out), "h:mm a")}</TableCell>
                    <TableCell>{t.break_minutes}m</TableCell>
                    <TableCell className="font-medium">{Number(t.total_hours).toFixed(1)}</TableCell>
                    <TableCell className={Number(t.overtime_hours) > 0 ? "text-amber-600 font-medium" : ""}>{Number(t.overtime_hours).toFixed(1)}</TableCell>
                    <TableCell className="font-medium">${Number(t.total_pay).toFixed(2)}</TableCell>
                    <TableCell><Badge className={statusBadge[t.status] || ""}>{t.status}</Badge></TableCell>
                    <TableCell>
                      {t.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => approveMutation.mutate(t.id)}>
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Timesheets;
