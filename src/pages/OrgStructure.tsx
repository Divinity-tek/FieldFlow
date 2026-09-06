import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Crown, Shield, UserCheck, Building2, Handshake, HeadsetIcon, ChevronDown } from "lucide-react";

const roleConfig: Record<string, { label: string; icon: any; color: string; level: number; description: string }> = {
  admin: { label: "Admin", icon: Crown, color: "bg-amber-500/15 text-amber-600 border-amber-500/30", level: 0, description: "Full platform access, system configuration, billing & user management" },
  team_lead: { label: "Team Lead", icon: Shield, color: "bg-blue-500/15 text-blue-600 border-blue-500/30", level: 1, description: "Operations management, engineer oversight, scheduling & SLA monitoring" },
  associate_coordinator: { label: "Associate Coordinator", icon: HeadsetIcon, color: "bg-purple-500/15 text-purple-600 border-purple-500/30", level: 2, description: "Case mediation, ticket follow-ups, client-engineer liaison, escalation handling" },
  engineer: { label: "Engineer", icon: UserCheck, color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", level: 3, description: "Field service execution, job completion, timesheets & availability" },
  partner: { label: "Partner", icon: Handshake, color: "bg-orange-500/15 text-orange-600 border-orange-500/30", level: 2, description: "Client referrals, revenue tracking, job monitoring for partner clients" },
  client: { label: "Client", icon: Building2, color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30", level: 3, description: "Service requests, job tracking, estimates/invoices, support" },
};

const OrgStructure = () => {
  const { data: roleCounts, isLoading } = useQuery({
    queryKey: ["org-role-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role");
      const counts: Record<string, number> = {};
      data?.forEach((r: any) => { counts[r.role] = (counts[r.role] || 0) + 1; });
      return counts;
    },
  });

  const { data: recentProfiles } = useQuery({
    queryKey: ["org-recent-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, user_id").limit(50);
      return data || [];
    },
  });

  const { data: roleAssignments } = useQuery({
    queryKey: ["org-role-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data || [];
    },
  });

  const getUsersByRole = (role: string) => {
    const userIds = roleAssignments?.filter((r: any) => r.role === role).map((r: any) => r.user_id) || [];
    return recentProfiles?.filter((p: any) => userIds.includes(p.user_id)) || [];
  };

  const totalUsers = Object.values(roleCounts || {}).reduce((s, c) => s + c, 0);

  const hierarchy = [
    { roles: ["admin"], label: "Leadership" },
    { roles: ["team_lead"], label: "Management" },
    { roles: ["associate_coordinator", "partner"], label: "Coordination & Partners" },
    { roles: ["engineer", "client"], label: "Field & Clients" },
  ];

  return (
    <AppLayout title="Organization Structure" subtitle="Hierarchical view of roles and team members">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(roleConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = roleCounts?.[key] || 0;
            return (
              <Card key={key} className="border-border/50">
                <CardContent className="p-4 text-center">
                  <div className={`w-10 h-10 rounded-xl ${cfg.color} flex items-center justify-center mx-auto mb-2 border`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold font-display text-card-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}s</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Org Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Organization Hierarchy
              <Badge variant="secondary" className="ml-auto text-xs">{totalUsers} Total Members</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {hierarchy.map((tier, tierIdx) => (
                <div key={tier.label}>
                  {/* Connector line */}
                  {tierIdx > 0 && (
                    <div className="flex justify-center py-1">
                      <div className="flex flex-col items-center">
                        <div className="w-px h-4 bg-border" />
                        <ChevronDown className="w-4 h-4 text-muted-foreground -mt-1" />
                      </div>
                    </div>
                  )}

                  <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">{tier.label}</p>
                    <div className={`grid gap-3 ${tier.roles.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : "grid-cols-1 md:grid-cols-2"}`}>
                      {tier.roles.map((roleKey) => {
                        const cfg = roleConfig[roleKey];
                        const Icon = cfg.icon;
                        const users = getUsersByRole(roleKey);
                        const count = roleCounts?.[roleKey] || 0;
                        return (
                          <div key={roleKey} className="bg-background rounded-lg border border-border/60 p-4">
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`w-9 h-9 rounded-lg ${cfg.color} flex items-center justify-center border shrink-0`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-sm text-card-foreground">{cfg.label}</h4>
                                  <Badge variant="outline" className="text-[10px] h-5">{count}</Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{cfg.description}</p>
                              </div>
                            </div>
                            {users.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/40">
                                {users.slice(0, 8).map((u: any) => (
                                  <div key={u.user_id} className="flex items-center gap-1.5 bg-muted/50 rounded-full pl-0.5 pr-2 py-0.5">
                                    <Avatar className="w-5 h-5">
                                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                        {u.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[10px] text-card-foreground truncate max-w-[80px]">{u.full_name}</span>
                                  </div>
                                ))}
                                {users.length > 8 && (
                                  <span className="text-[10px] text-muted-foreground self-center">+{users.length - 8} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reporting Structure */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reporting & Escalation Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-card-foreground">Escalation Path</h4>
                {[
                  { from: "Engineer", to: "Team Lead", trigger: "Job issues, availability conflicts" },
                  { from: "Associate Coordinator", to: "Team Lead", trigger: "Unresolved client disputes, SLA breaches" },
                  { from: "Team Lead", to: "Admin", trigger: "Budget approvals, critical incidents" },
                  { from: "Client", to: "Associate Coordinator", trigger: "Service complaints, urgent requests" },
                  { from: "Partner", to: "Admin", trigger: "Commission disputes, contract changes" },
                ].map((esc, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                    <Badge variant="outline" className="text-[10px] shrink-0">{esc.from}</Badge>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{esc.to}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto truncate">{esc.trigger}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-card-foreground">Access Levels</h4>
                {[
                  { role: "Admin", access: "Full CRUD on all modules, user management, billing, system config" },
                  { role: "Team Lead", access: "Manage jobs, engineers, scheduling, estimates, invoices, reports" },
                  { role: "Coordinator", access: "View/update jobs, manage tickets, follow-ups, client communications" },
                  { role: "Engineer", access: "Own jobs, timesheets, availability, forms, dispatch tickets" },
                  { role: "Partner", access: "Own clients, jobs, revenue reports" },
                  { role: "Client", access: "Service requests, job tracking, estimates, invoices, history" },
                ].map((item, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                    <span className="text-xs font-medium text-card-foreground">{item.role}: </span>
                    <span className="text-[10px] text-muted-foreground">{item.access}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default OrgStructure;
