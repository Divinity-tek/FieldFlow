import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  BarChart3, Download, RefreshCw, FileText, TrendingUp, Users, Wrench,
  Save, Trash2, ChevronDown, ChevronUp, Search, Bookmark,
  CalendarClock, ArrowUpDown, Columns, Sparkles,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addDays, addWeeks, addMonths } from "date-fns";
import { toast } from "sonner";
import {
  applySearch, applySort, exportCSV, exportJSON, exportXLSX,
  inferColumns, pickColumns, suggestChartAxes,
  type ChartType, type SortDir,
} from "@/lib/reportUtils";
import { ReportChart } from "@/components/reports/ReportChart";

type ReportType =
  | "jobs_summary" | "engineer_performance" | "revenue_by_client"
  | "sla_compliance" | "inventory_status" | "timesheet_summary";

const reportConfigs: Record<ReportType, { label: string; icon: any; description: string }> = {
  jobs_summary: { label: "Jobs Summary", icon: Wrench, description: "Overview of jobs by status, priority & type" },
  engineer_performance: { label: "Engineer Performance", icon: Users, description: "Engineer metrics: jobs, ratings, hours" },
  revenue_by_client: { label: "Revenue by Client", icon: TrendingUp, description: "Revenue breakdown by client" },
  sla_compliance: { label: "SLA Compliance", icon: BarChart3, description: "SLA breach rates & response times" },
  inventory_status: { label: "Inventory Status", icon: FileText, description: "Stock levels & low-stock alerts" },
  timesheet_summary: { label: "Timesheet Summary", icon: Users, description: "Hours, overtime & payroll" },
};

type SavedReport = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  report_type: ReportType;
  date_from: string | null;
  date_to: string | null;
  visible_columns: string[];
  sort_column: string | null;
  sort_direction: SortDir;
  chart_type: ChartType;
  chart_x: string | null;
  chart_y: string | null;
};

type ScheduleRow = {
  id: string;
  saved_report_id: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  is_active: boolean;
  next_run_at: string | null;
};

function nextRunFor(freq: "daily" | "weekly" | "monthly"): string {
  const base = new Date();
  const next = freq === "daily" ? addDays(base, 1) : freq === "weekly" ? addWeeks(base, 1) : addMonths(base, 1);
  return next.toISOString();
}

const ReportsBuilder = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── State ──
  const [reportType, setReportType] = useState<ReportType>("jobs_summary");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartX, setChartX] = useState<string | undefined>();
  const [chartY, setChartY] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);

  // ── Query: report data ──
  const { data: rawData = [], isLoading, refetch } = useQuery({
    queryKey: ["report", reportType, dateFrom, dateTo],
    queryFn: async () => {
      switch (reportType) {
        case "jobs_summary": {
          const { data } = await supabase.from("jobs")
            .select("status, priority, service_type, total_price, created_at")
            .gte("created_at", dateFrom).lte("created_at", dateTo + "T23:59:59");
          const grouped: Record<string, { count: number; revenue: number }> = {};
          (data || []).forEach((j: any) => {
            grouped[j.status] = grouped[j.status] || { count: 0, revenue: 0 };
            grouped[j.status].count++;
            grouped[j.status].revenue += Number(j.total_price || 0);
          });
          return Object.entries(grouped).map(([status, d]) => ({ status, ...d }));
        }
        case "engineer_performance": {
          const { data } = await supabase.from("engineers")
            .select("id, specialty, rating, jobs_completed, hourly_rate");
          return (data || []).map((e: any) => ({
            engineer: e.specialty, rating: e.rating || 0,
            jobs: e.jobs_completed || 0, rate: e.hourly_rate || 0,
          }));
        }
        case "revenue_by_client": {
          const { data: jobs } = await supabase.from("jobs")
            .select("client_id, total_price")
            .gte("created_at", dateFrom).lte("created_at", dateTo + "T23:59:59");
          const { data: clients } = await supabase.from("clients").select("id, company_name");
          const map: Record<string, string> = {};
          (clients || []).forEach((c: any) => { map[c.id] = c.company_name; });
          const grouped: Record<string, { total: number; count: number }> = {};
          (jobs || []).forEach((j: any) => {
            const name = map[j.client_id] || "Unknown";
            grouped[name] = grouped[name] || { total: 0, count: 0 };
            grouped[name].total += Number(j.total_price || 0);
            grouped[name].count++;
          });
          return Object.entries(grouped)
            .map(([client, d]) => ({ client, ...d }))
            .sort((a, b) => b.total - a.total);
        }
        case "sla_compliance": {
          const { data: breaches } = await supabase.from("sla_breaches")
            .select("breach_type, target_minutes, actual_minutes")
            .gte("created_at", dateFrom).lte("created_at", dateTo + "T23:59:59");
          const grouped: Record<string, { count: number; avgOver: number }> = {};
          (breaches || []).forEach((b: any) => {
            grouped[b.breach_type] = grouped[b.breach_type] || { count: 0, avgOver: 0 };
            grouped[b.breach_type].count++;
            grouped[b.breach_type].avgOver += Number(b.actual_minutes || 0) - Number(b.target_minutes);
          });
          return Object.entries(grouped).map(([type, d]) => ({
            type, count: d.count, avg_overrun: Math.round(d.avgOver / d.count),
          }));
        }
        case "inventory_status": {
          const { data } = await supabase.from("inventory_items")
            .select("name, category, quantity, min_stock_level, unit_cost");
          return (data || []).map((i: any) => ({
            name: i.name, category: i.category, qty: i.quantity, min: i.min_stock_level,
            value: Number((i.quantity * (i.unit_cost || 0)).toFixed(2)),
            low_stock: i.quantity < i.min_stock_level,
          }));
        }
        case "timesheet_summary": {
          const { data } = await supabase.from("timesheets")
            .select("engineer_id, total_hours, overtime_hours, total_pay")
            .gte("date", dateFrom).lte("date", dateTo);
          const grouped: Record<string, { hours: number; ot: number; pay: number; entries: number }> = {};
          (data || []).forEach((t: any) => {
            const eid = t.engineer_id.slice(0, 8);
            grouped[eid] = grouped[eid] || { hours: 0, ot: 0, pay: 0, entries: 0 };
            grouped[eid].hours += Number(t.total_hours);
            grouped[eid].ot += Number(t.overtime_hours);
            grouped[eid].pay += Number(t.total_pay);
            grouped[eid].entries++;
          });
          return Object.entries(grouped).map(([engineer, d]) => ({ engineer, ...d }));
        }
        default: return [];
      }
    },
  });

  const allColumns = useMemo(() => inferColumns(rawData as any[]), [rawData]);
  const visibleColumns = useMemo(
    () => allColumns.filter((c) => !hiddenColumns.has(c)),
    [allColumns, hiddenColumns],
  );

  const processedRows = useMemo(() => {
    let r = rawData as Record<string, unknown>[];
    r = applySearch(r, search, allColumns);
    r = applySort(r, sortColumn, sortDir);
    return r;
  }, [rawData, search, sortColumn, sortDir, allColumns]);

  const pagedRows = useMemo(() => {
    const start = page * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, page, pageSize]);

  useEffect(() => { setPage(0); }, [reportType, search, dateFrom, dateTo]);

  // Auto-pick chart axes when data loads
  useEffect(() => {
    if (rawData.length && !chartX && !chartY) {
      const { x, y } = suggestChartAxes(rawData as any[]);
      setChartX(x); setChartY(y);
    }
  }, [rawData, chartX, chartY]);

  const visibleRows = useMemo(() => pickColumns(pagedRows, visibleColumns), [pagedRows, visibleColumns]);

  // ── Saved reports ──
  const { data: savedReports = [] } = useQuery({
    queryKey: ["saved-reports", user?.id],
    queryFn: async (): Promise<SavedReport[]> => {
      const { data } = await supabase.from("saved_reports").select("*").order("updated_at", { ascending: false });
      return (data ?? []) as SavedReport[];
    },
    enabled: !!user?.id,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["report-schedules", user?.id],
    queryFn: async (): Promise<ScheduleRow[]> => {
      const { data } = await supabase.from("report_schedules").select("*");
      return (data ?? []) as ScheduleRow[];
    },
    enabled: !!user?.id,
  });

  const saveReport = useMutation({
    mutationFn: async (vars: { name: string; description?: string }) => {
      if (!user?.id) throw new Error("Not signed in");
      const payload = {
        owner_id: user.id,
        name: vars.name.trim(),
        description: vars.description?.trim() || null,
        report_type: reportType,
        date_mode: "custom",
        date_from: dateFrom,
        date_to: dateTo,
        filters: {},
        visible_columns: visibleColumns,
        sort_column: sortColumn,
        sort_direction: sortDir,
        chart_type: chartType,
        chart_x: chartX ?? null,
        chart_y: chartY ?? null,
      };
      const { error } = await supabase.from("saved_reports").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
      toast.success("Report saved");
    },
    onError: (e: Error) => toast.error("Save failed", { description: e.message }),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
      qc.invalidateQueries({ queryKey: ["report-schedules"] });
      toast.success("Saved report removed");
    },
  });

  const loadSaved = (r: SavedReport) => {
    setActiveSavedId(r.id);
    setReportType(r.report_type);
    if (r.date_from) setDateFrom(r.date_from);
    if (r.date_to) setDateTo(r.date_to);
    setSortColumn(r.sort_column);
    setSortDir(r.sort_direction);
    setChartType(r.chart_type);
    setChartX(r.chart_x ?? undefined);
    setChartY(r.chart_y ?? undefined);
    if (r.visible_columns?.length) {
      setHiddenColumns(new Set()); // we'll re-evaluate after data loads
      setTimeout(() => {
        const next = new Set<string>();
        inferColumns(rawData as any[]).forEach((c) => {
          if (!r.visible_columns.includes(c)) next.add(c);
        });
        setHiddenColumns(next);
      }, 100);
    }
    toast.success(`Loaded "${r.name}"`);
  };

  // ── Schedule dialog ──
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<SavedReport | null>(null);
  const [scheduleFreq, setScheduleFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [scheduleRecipients, setScheduleRecipients] = useState("");

  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!user?.id || !scheduleFor) throw new Error("Missing info");
      const recipients = scheduleRecipients
        .split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      if (!recipients.length) throw new Error("Add at least one recipient email");
      const { error } = await supabase.from("report_schedules").insert({
        saved_report_id: scheduleFor.id,
        owner_id: user.id,
        frequency: scheduleFreq,
        recipients,
        is_active: true,
        next_run_at: nextRunFor(scheduleFreq),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-schedules"] });
      toast.success("Schedule created");
      setScheduleDialog(false);
      setScheduleRecipients("");
    },
    onError: (e: Error) => toast.error("Schedule failed", { description: e.message }),
  });

  const toggleSchedule = useMutation({
    mutationFn: async (s: ScheduleRow) => {
      const { error } = await supabase.from("report_schedules")
        .update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-schedules"] }),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-schedules"] }),
  });

  // ── Save dialog ──
  const [saveDialog, setSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");

  const config = reportConfigs[reportType];
  const fileBase = `${reportType}_${dateFrom}_${dateTo}`;
  const totalRevenue = useMemo(() => {
    return (processedRows as any[]).reduce((sum, r) => {
      for (const k of ["revenue", "total", "pay", "value"]) {
        if (typeof r[k] === "number") return sum + r[k];
      }
      return sum;
    }, 0);
  }, [processedRows]);

  return (
    <AppLayout title="Reports Builder">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Reports Builder</h1>
            <p className="text-muted-foreground text-sm">
              Build, save, schedule and export rich reports with charts.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => refetch()} className="gap-2" size="sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Dialog open={saveDialog} onOpenChange={setSaveDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Save className="w-4 h-4" /> Save report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save report configuration</DialogTitle>
                  <DialogDescription>
                    Saves the current report type, date range, columns, sort and chart settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="save-name">Name</Label>
                    <Input id="save-name" value={saveName} maxLength={100}
                      onChange={(e) => setSaveName(e.target.value)} placeholder="Monthly revenue review" />
                  </div>
                  <div>
                    <Label htmlFor="save-desc">Description (optional)</Label>
                    <Input id="save-desc" value={saveDesc} maxLength={300}
                      onChange={(e) => setSaveDesc(e.target.value)} placeholder="Weekly board review" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialog(false)}>Cancel</Button>
                  <Button
                    disabled={!saveName.trim() || saveReport.isPending}
                    onClick={async () => {
                      await saveReport.mutateAsync({ name: saveName, description: saveDesc });
                      setSaveDialog(false);
                      setSaveName(""); setSaveDesc("");
                    }}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={false} onSelect={() => exportCSV(visibleRows, fileBase)}>
                  CSV
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={false} onSelect={() => exportXLSX(visibleRows, fileBase)}>
                  Excel (.xlsx)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={false} onSelect={() => exportJSON(visibleRows, fileBase)}>
                  JSON
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Saved reports */}
        {savedReports.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bookmark className="w-4 h-4" /> Saved reports
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {savedReports.map((r) => {
                const sched = schedules.find((s) => s.saved_report_id === r.id);
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      activeSavedId === r.id ? "border-primary bg-primary/5" : "bg-card"
                    }`}
                  >
                    <button
                      onClick={() => loadSaved(r)}
                      className="font-medium hover:text-primary"
                    >
                      {r.name}
                    </button>
                    <Badge variant="outline" className="text-[10px]">
                      {reportConfigs[r.report_type]?.label}
                    </Badge>
                    {sched && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {sched.frequency}{sched.is_active ? "" : " (paused)"}
                      </Badge>
                    )}
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => { setScheduleFor(r); setScheduleDialog(true); }}
                      aria-label="Schedule"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => deleteReport.mutate(r.id)}
                      aria-label="Delete saved report"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[200px]">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={(v) => { setReportType(v as ReportType); setActiveSavedId(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(reportConfigs).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
              <div className="min-w-[200px] flex-1">
                <Label>Search results</Label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter rows..."
                    className="pl-7"
                  />
                </div>
              </div>
              <Button onClick={() => refetch()}>Generate</Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
              <config.icon className="w-4 h-4" /> {config.description}
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Records</p>
            <p className="text-2xl font-bold">{processedRows.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Date Range</p>
            <p className="text-xs font-medium">{format(new Date(dateFrom), "MMM d")} — {format(new Date(dateTo), "MMM d")}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="text-xs font-medium">{config.label}</p>
          </CardContent></Card>
        </div>

        {/* Chart */}
        {chartType !== "none" && rawData.length > 0 && (
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Visualization
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="pie">Pie</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={chartX} onValueChange={setChartX}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="X axis" /></SelectTrigger>
                  <SelectContent>
                    {allColumns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={chartY} onValueChange={setChartY}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Y axis" /></SelectTrigger>
                  <SelectContent>
                    {allColumns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ReportChart type={chartType} data={processedRows} xKey={chartX} yKey={chartY} />
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{config.label} Results</CardTitle>
            <div className="flex items-center gap-2">
              {chartType === "none" && (
                <Button variant="outline" size="sm" onClick={() => setChartType("bar")} className="gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Add chart
                </Button>
              )}
              {allColumns.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Columns className="w-3.5 h-3.5" /> Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allColumns.map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c}
                        checked={!hiddenColumns.has(c)}
                        onCheckedChange={(checked) => {
                          setHiddenColumns((prev) => {
                            const next = new Set(prev);
                            if (checked) next.delete(c); else next.add(c);
                            return next;
                          });
                        }}
                      >
                        {c}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading report data...</div>
            ) : processedRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No data found for selected criteria</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.map((key) => (
                        <TableHead
                          key={key}
                          onClick={() => {
                            if (sortColumn === key) {
                              setSortDir(sortDir === "asc" ? "desc" : "asc");
                            } else {
                              setSortColumn(key); setSortDir("asc");
                            }
                          }}
                          className="capitalize cursor-pointer select-none hover:text-foreground"
                        >
                          <span className="inline-flex items-center gap-1">
                            {key.replace(/_/g, " ")}
                            {sortColumn === key ? (
                              sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row, i) => (
                      <TableRow key={i}>
                        {visibleColumns.map((key) => {
                          const val = (row as any)[key];
                          return (
                            <TableCell key={key} className={typeof val === "number" ? "font-mono" : ""}>
                              {typeof val === "boolean"
                                ? (val ? "⚠️ Yes" : "✓ No")
                                : typeof val === "number"
                                  ? val.toLocaleString()
                                  : String(val ?? "")}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                      <SelectTrigger className="h-7 w-16"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      {page * pageSize + 1}–{Math.min((page + 1) * pageSize, processedRows.length)} of {processedRows.length}
                    </span>
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={(page + 1) * pageSize >= processedRows.length}
                      onClick={() => setPage((p) => p + 1)}
                    >Next</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Schedules list */}
        {schedules.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4" /> Active schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Next run</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => {
                    const r = savedReports.find((x) => x.id === s.saved_report_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium">{r?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs capitalize">{s.frequency}</TableCell>
                        <TableCell className="text-xs">{s.recipients.join(", ")}</TableCell>
                        <TableCell className="text-xs">
                          {s.next_run_at ? format(new Date(s.next_run_at), "MMM d, h:mm a") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Switch checked={s.is_active} onCheckedChange={() => toggleSchedule.mutate(s)} />
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => deleteSchedule.mutate(s.id)} aria-label="Delete schedule">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Schedule dialog */}
        <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule “{scheduleFor?.name}”</DialogTitle>
              <DialogDescription>
                We'll generate this report on the cadence you choose and email it to recipients.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Frequency</Label>
                <Select value={scheduleFreq} onValueChange={(v) => setScheduleFreq(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
                <Input
                  id="recipients" placeholder="ops@company.com, lead@company.com"
                  value={scheduleRecipients}
                  onChange={(e) => setScheduleRecipients(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialog(false)}>Cancel</Button>
              <Button onClick={() => createSchedule.mutate()} disabled={createSchedule.isPending}>
                Create schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ReportsBuilder;
