import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "job_assigned" | "job_status" | "new_ticket" | "ticket_update" | "sla_breach" | "info";
  timestamp: Date;
  read: boolean;
}

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { data: userRole } = useQuery({
    queryKey: ["notif-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .limit(1);
      return data?.[0]?.role ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: engineerId } = useQuery({
    queryKey: ["notif-eng-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user?.id && userRole === "engineer",
  });

  const addNotification = useCallback((n: Omit<Notification, "id" | "timestamp" | "read">) => {
    // Check user's notification preferences
    if (n.type === "job_assigned" && localStorage.getItem("notif_job_assigned") === "false") return;
    if (n.type === "job_status" && localStorage.getItem("notif_status_change") === "false") return;
    if ((n.type === "new_ticket" || n.type === "ticket_update") && localStorage.getItem("notif_new_ticket") === "false") return;

    const notif: Notification = {
      ...n,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 50));
    setUnreadCount((c) => c + 1);
    toast(n.title, { description: n.message });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Job changes channel
    const jobChannel = supabase
      .channel("notif-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          if (payload.eventType === "UPDATE" && oldRow.status !== newRow.status) {
            // Status change
            const statusLabel = newRow.status.replace(/_/g, " ");

            // Notify engineer if they're assigned
            if (userRole === "engineer" && newRow.engineer_id === engineerId) {
              addNotification({
                type: "job_status",
                title: "Job Status Updated",
                message: `"${newRow.title}" is now ${statusLabel}`,
              });
            }

            // Notify admins/team leads
            if (userRole === "admin" || userRole === "team_lead") {
              addNotification({
                type: "job_status",
                title: "Job Status Changed",
                message: `"${newRow.title}" moved to ${statusLabel}`,
              });
            }

            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ["analytics-jobs"] });
            queryClient.invalidateQueries({ queryKey: ["fin-jobs"] });
            queryClient.invalidateQueries({ queryKey: ["tl-all-jobs"] });
          }

          if (payload.eventType === "UPDATE" && oldRow.engineer_id !== newRow.engineer_id && newRow.engineer_id) {
            // Job assignment/reassignment
            if (userRole === "engineer" && newRow.engineer_id === engineerId) {
              addNotification({
                type: "job_assigned",
                title: "New Job Assigned! 🎯",
                message: `You've been assigned "${newRow.title}" at ${newRow.location}`,
              });
            }

            if (userRole === "admin" || userRole === "team_lead") {
              addNotification({
                type: "job_assigned",
                title: "Job Assigned",
                message: `"${newRow.title}" has been assigned to an engineer`,
              });
            }
          }

          if (payload.eventType === "INSERT") {
            if (userRole === "admin" || userRole === "team_lead") {
              addNotification({
                type: "info",
                title: "New Job Created",
                message: `"${newRow.title}" — ${newRow.service_type} at ${newRow.location}`,
              });
            }
          }
        }
      )
      .subscribe();
    channels.push(jobChannel);

    // Ticket changes channel
    const ticketChannel = supabase
      .channel("notif-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          if (payload.eventType === "INSERT") {
            if (userRole === "admin" || userRole === "team_lead") {
              addNotification({
                type: "new_ticket",
                title: `New ${newRow.category === "complaint" ? "Complaint" : "Ticket"} 🎫`,
                message: `"${newRow.subject}" — ${newRow.priority} priority`,
              });
            }
          }

          if (payload.eventType === "UPDATE" && oldRow.status !== newRow.status) {
            if (userRole === "admin" || userRole === "team_lead") {
              addNotification({
                type: "ticket_update",
                title: "Ticket Updated",
                message: `"${newRow.subject}" is now ${newRow.status.replace(/_/g, " ")}`,
              });
            }
          }
        }
      )
      .subscribe();
    channels.push(ticketChannel);

    // SLA breach channel
    const slaChannel = supabase
      .channel("notif-sla-breaches")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sla_breaches" },
        (payload) => {
          const newRow = payload.new as any;
          if (userRole === "admin" || userRole === "team_lead") {
            addNotification({
              type: "sla_breach",
              title: "🚨 SLA Breach Detected",
              message: `${newRow.breach_type} SLA breached — target was ${newRow.target_minutes}m, actual ${newRow.actual_minutes || "ongoing"}m`,
            });
          }
        }
      )
      .subscribe();
    channels.push(slaChannel);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [user?.id, userRole, engineerId, addNotification, queryClient]);

  return { notifications, unreadCount, markAllRead, markRead };
};
