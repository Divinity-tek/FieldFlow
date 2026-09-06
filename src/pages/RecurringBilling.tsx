import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTranslation } from "react-i18next";
import { Repeat, Calendar, DollarSign, Pause, Play, Plus, TrendingUp } from "lucide-react";
import { format, addDays, addMonths, addYears } from "date-fns";
import { toast } from "sonner";

const computeNextRun = (start: string, freq: string) => {
  const base = new Date(start);
  const now = new Date();
  let next = base;
  const step = (d: Date) => {
    if (freq === "weekly") return addDays(d, 7);
    if (freq === "monthly") return addMonths(d, 1);
    if (freq === "quarterly") return addMonths(d, 3);
    if (freq === "yearly") return addYears(d, 1);
    return addMonths(d, 1);
  };
  let safety = 0;
  while (next < now && safety++ < 1000) next = step(next);
  return next;
};

const RecurringBilling = () => {
  const { t } = useTranslation();
  const { format: fmt } = useCurrency();

  const { data: agreements = [], refetch } = useQuery({
    queryKey: ["recurring-agreements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_agreements")
        .select("id, title, amount, billing_frequency, start_date, end_date, status, client_id, clients:client_id(company_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { mrr, arr, active, paused } = useMemo(() => {
    let monthly = 0;
    let act = 0, pau = 0;
    for (const a of agreements as any[]) {
      const isActive = a.status === "active";
      if (isActive) act++; else pau++;
      if (!isActive) continue;
      const f = a.billing_frequency;
      const amt = Number(a.amount) || 0;
      if (f === "weekly") monthly += amt * 4.33;
      else if (f === "monthly") monthly += amt;
      else if (f === "quarterly") monthly += amt / 3;
      else if (f === "yearly") monthly += amt / 12;
    }
    return { mrr: monthly, arr: monthly * 12, active: act, paused: pau };
  }, [agreements]);

  const togglePause = async (a: any) => {
    const newStatus = a.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("service_agreements")
      .update({ status: newStatus })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Subscription ${newStatus}`);
      refetch();
    }
  };

  return (
    <AppLayout
      title={t("billing.recurring")}
      subtitle="Automated subscription billing for service agreements"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">MRR</p>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-2">{fmt(mrr)}</p>
          <p className="text-xs text-muted-foreground mt-1">Monthly Recurring</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">ARR</p>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-2">{fmt(arr)}</p>
          <p className="text-xs text-muted-foreground mt-1">Annual Recurring</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p>
            <Repeat className="w-4 h-4 text-success" />
          </div>
          <p className="text-2xl font-bold mt-2">{active}</p>
          <p className="text-xs text-muted-foreground mt-1">Subscriptions</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Paused</p>
            <Pause className="w-4 h-4 text-warning" />
          </div>
          <p className="text-2xl font-bold mt-2">{paused}</p>
          <p className="text-xs text-muted-foreground mt-1">Subscriptions</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t("billing.subscriptions")}</h3>
          <Button size="sm" asChild>
            <a href="/service-agreements"><Plus className="w-4 h-4 mr-2" />New Agreement</a>
          </Button>
        </div>
        <div className="space-y-2">
          {agreements.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No service agreements yet. Create one to start recurring billing.
            </p>
          )}
          {(agreements as any[]).map(a => {
            const next = computeNextRun(a.start_date, a.billing_frequency);
            return (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm truncate">{a.title}</p>
                    <Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px]">
                      {a.status === "active" ? t("billing.active") : t("billing.paused")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{a.billing_frequency}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.clients?.company_name || "—"}
                  </p>
                </div>
                <div className="text-right mx-4 hidden sm:block">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <Calendar className="w-3 h-3" /> {t("billing.nextRun")}
                  </p>
                  <p className="text-sm font-medium">{format(next, "MMM d, yyyy")}</p>
                </div>
                <div className="text-right mr-4">
                  <p className="font-bold text-sm">{fmt(Number(a.amount) || 0)}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">/{a.billing_frequency.replace("ly", "")}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePause(a)}
                  title={a.status === "active" ? "Pause" : "Resume"}
                >
                  {a.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </AppLayout>
  );
};

export default RecurringBilling;
