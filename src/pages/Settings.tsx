import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Moon, Sun, Bell, Shield, Save, Lightbulb, Play } from "lucide-react";
import { toast } from "sonner";
import { useOnboarding } from "@/components/onboarding/OnboardingContext";

const Settings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { startTour } = useOnboarding();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  // Notification preferences (stored in localStorage)
  const [notifJobAssigned, setNotifJobAssigned] = useState(() => localStorage.getItem("notif_job_assigned") !== "false");
  const [notifStatusChange, setNotifStatusChange] = useState(() => localStorage.getItem("notif_status_change") !== "false");
  const [notifNewTicket, setNotifNewTicket] = useState(() => localStorage.getItem("notif_new_ticket") !== "false");
  const [notifSound, setNotifSound] = useState(() => localStorage.getItem("notif_sound") !== "false");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["settings-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userRole } = useQuery({
    queryKey: ["settings-role", user?.id],
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

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  // Theme toggle
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Save notification preferences
  useEffect(() => {
    localStorage.setItem("notif_job_assigned", String(notifJobAssigned));
    localStorage.setItem("notif_status_change", String(notifStatusChange));
    localStorage.setItem("notif_new_ticket", String(notifNewTicket));
    localStorage.setItem("notif_sound", String(notifSound));
  }, [notifJobAssigned, notifStatusChange, notifNewTicket, notifSound]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["settings-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Failed to update profile"),
  });

  // Reset all help banners from DB
  const resetHelpBanners = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("user_preferences")
      .select("id, key")
      .eq("user_id", user.id)
      .like("key", "help-banner-dismissed-%");
    if (data && data.length > 0) {
      await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user.id)
        .like("key", "help-banner-dismissed-%");
    }
    toast.success(`${data?.length || 0} help banner(s) reset — they'll reappear on next visit`);
  };

  // Reset onboarding from DB
  const resetOnboarding = async () => {
    if (!user?.id) return;
    await supabase
      .from("user_preferences")
      .delete()
      .eq("user_id", user.id)
      .like("key", "onboarding-completed-%");
    startTour();
    toast.success("Tour restarted — follow the highlighted steps!");
  };

  // Reset exploration progress from DB
  const resetExploration = async () => {
    if (!user?.id) return;
    await supabase
      .from("user_preferences")
      .delete()
      .eq("user_id", user.id)
      .in("key", ["explored-pages", "exploration-badges"]);
    toast.success("Exploration progress reset!");
  };

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <AppLayout title="Settings" subtitle="Manage your account and preferences">
      <div className="max-w-2xl space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">{initials}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{profile?.full_name ?? "Loading..."}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {userRole && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary capitalize">
                    {userRole.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <Label htmlFor="fullName" className="flex items-center gap-2 text-sm mb-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center gap-2 text-sm mb-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Label>
                <Input id="email" value={user?.email ?? ""} disabled className="opacity-60" />
                <p className="text-[11px] text-muted-foreground mt-1">Email cannot be changed here</p>
              </div>
              <div>
                <Label htmlFor="phone" className="flex items-center gap-2 text-sm mb-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555-0100"
                  maxLength={20}
                />
              </div>
            </div>

            <button
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending || !fullName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save className="w-4 h-4" />
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
              </div>
              <Switch checked={isDark} onCheckedChange={setIsDark} />
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Job Assignments</p>
                <p className="text-xs text-muted-foreground">Get notified when jobs are assigned or reassigned</p>
              </div>
              <Switch checked={notifJobAssigned} onCheckedChange={setNotifJobAssigned} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Status Changes</p>
                <p className="text-xs text-muted-foreground">Get notified when job statuses are updated</p>
              </div>
              <Switch checked={notifStatusChange} onCheckedChange={setNotifStatusChange} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">New Tickets & Complaints</p>
                <p className="text-xs text-muted-foreground">Get notified when new support tickets are created</p>
              </div>
              <Switch checked={notifNewTicket} onCheckedChange={setNotifNewTicket} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Notification Sounds</p>
                <p className="text-xs text-muted-foreground">Play a sound for new notifications</p>
              </div>
              <Switch checked={notifSound} onCheckedChange={setNotifSound} />
            </div>
          </CardContent>
        </Card>

        {/* Help Banners */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> Help & Hints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Reset Help Banners</p>
                <p className="text-xs text-muted-foreground">Show all first-time page hints again</p>
              </div>
              <button
                onClick={resetHelpBanners}
                className="px-4 py-2 rounded-lg border border-input bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Reset All
              </button>
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Guided Tour</p>
                <p className="text-xs text-muted-foreground">Replay the step-by-step walkthrough of key features</p>
              </div>
              <button
                onClick={resetOnboarding}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Restart Tour
              </button>
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Reset Exploration Progress</p>
                <p className="text-xs text-muted-foreground">Clear your feature exploration tracker and start fresh</p>
              </div>
              <button
                onClick={resetExploration}
                className="px-4 py-2 rounded-lg border border-input bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Reset
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" /> Account & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Change Password</p>
                <p className="text-xs text-muted-foreground">Update your account password</p>
              </div>
              <button
                onClick={async () => {
                  const { error } = await supabase.auth.resetPasswordForEmail(user?.email ?? "");
                  if (error) toast.error("Failed to send reset email");
                  else toast.success("Password reset email sent!");
                }}
                className="px-4 py-2 rounded-lg border border-input bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Reset Password
              </button>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">
                Account created: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
