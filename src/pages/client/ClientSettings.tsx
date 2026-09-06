import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, Bell, Shield, Save, Sun, Moon } from "lucide-react";

const ClientSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [notifJobUpdates, setNotifJobUpdates] = useState(true);
  const [notifNewTickets, setNotifNewTickets] = useState(true);
  const [notifCompletions, setNotifCompletions] = useState(true);
  const [notifSound, setNotifSound] = useState(() => localStorage.getItem("notif_sound") !== "false");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  const handleThemeToggle = (checked: boolean) => {
    setDarkMode(checked);
    localStorage.setItem("theme", checked ? "dark" : "light");
    document.documentElement.classList.toggle("dark", checked);
  };

  const { data: clientRecord, isLoading } = useQuery({
    queryKey: ["client-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (clientRecord) {
      setCompanyName(clientRecord.company_name || "");
      setContactName(clientRecord.contact_name || "");
      setEmail(clientRecord.email || "");
      setPhone(clientRecord.phone || "");
      setAddress(clientRecord.address || "");
    }
  }, [clientRecord]);

  useEffect(() => {
    setNotifJobUpdates(localStorage.getItem("notif_job_status") !== "false");
    setNotifNewTickets(localStorage.getItem("notif_new_ticket") !== "false");
    setNotifCompletions(localStorage.getItem("notif_job_completed") !== "false");
  }, []);

  const updateClientMutation = useMutation({
    mutationFn: async () => {
      if (!clientRecord?.id) throw new Error("No client record found");
      const { error } = await supabase
        .from("clients")
        .update({
          company_name: companyName,
          contact_name: contactName,
          email,
          phone: phone || null,
          address: address || null,
        })
        .eq("id", clientRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-settings"] });
      toast.success("Company info updated successfully");
    },
    onError: () => toast.error("Failed to update company info"),
  });

  const handleSaveNotifications = () => {
    localStorage.setItem("notif_job_status", String(notifJobUpdates));
    localStorage.setItem("notif_new_ticket", String(notifNewTickets));
    localStorage.setItem("notif_job_completed", String(notifCompletions));
    localStorage.setItem("notif_sound", String(notifSound));
    toast.success("Notification preferences saved");
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Failed to send reset email");
    } else {
      toast.success("Password reset email sent");
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Settings">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your company information and preferences
          </p>
        </div>

        {/* Company Information */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Primary contact"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="company@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
                rows={2}
              />
            </div>
            <Button
              onClick={() => updateClientMutation.mutate()}
              disabled={updateClientMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-foreground">Job Status Updates</p>
                <p className="text-xs text-muted-foreground">Get notified when your jobs change status</p>
              </div>
              <Switch checked={notifJobUpdates} onCheckedChange={setNotifJobUpdates} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-foreground">Ticket Updates</p>
                <p className="text-xs text-muted-foreground">Notifications for support ticket responses</p>
              </div>
              <Switch checked={notifNewTickets} onCheckedChange={setNotifNewTickets} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-foreground">Job Completions</p>
                <p className="text-xs text-muted-foreground">Alert when an engineer completes a job</p>
              </div>
              <Switch checked={notifCompletions} onCheckedChange={setNotifCompletions} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-foreground">Notification Sounds</p>
                <p className="text-xs text-muted-foreground">Play a sound when new chat messages arrive</p>
              </div>
              <Switch checked={notifSound} onCheckedChange={setNotifSound} />
            </div>
            <Button onClick={handleSaveNotifications} variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            {darkMode ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
            <CardTitle className="text-lg">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Switch between light and dark theme</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={handleThemeToggle} />
            </div>
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Account Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Signed in as <span className="font-medium text-foreground">{user?.email}</span>
              </p>
            </div>
            <Button variant="outline" onClick={handleResetPassword}>
              Reset Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ClientSettings;
