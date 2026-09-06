import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import PresenceDot from "./PresenceDot";
import {
  Mail, Phone, MapPin, Shield, Car, Wrench, Star, Briefcase,
  Crown, Users, Handshake, UserCheck, User, MessageSquare, ExternalLink,
} from "lucide-react";

interface UserProfileCardProps {
  userId: string;
  isOnline?: boolean;
  children: React.ReactNode;
}

const ROLE_CONFIG: Record<string, {
  gradient: string;
  icon: React.ReactNode;
  label: string;
  badgeClass: string;
  avatarRing: string;
}> = {
  admin: {
    gradient: "bg-gradient-to-br from-rose-500 via-red-500 to-orange-500",
    icon: <Crown className="w-3.5 h-3.5" />,
    label: "Admin",
    badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
    avatarRing: "ring-2 ring-rose-500/50",
  },
  team_lead: {
    gradient: "bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500",
    icon: <Users className="w-3.5 h-3.5" />,
    label: "Team Lead",
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
    avatarRing: "ring-2 ring-violet-500/50",
  },
  engineer: {
    gradient: "bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500",
    icon: <Wrench className="w-3.5 h-3.5" />,
    label: "Engineer",
    badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    avatarRing: "ring-2 ring-blue-500/50",
  },
  client: {
    gradient: "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500",
    icon: <UserCheck className="w-3.5 h-3.5" />,
    label: "Client",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    avatarRing: "ring-2 ring-emerald-500/50",
  },
  partner: {
    gradient: "bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500",
    icon: <Handshake className="w-3.5 h-3.5" />,
    label: "Partner",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    avatarRing: "ring-2 ring-amber-500/50",
  },
};

const DEFAULT_ROLE_CONFIG = {
  gradient: "bg-gradient-to-br from-slate-400 via-gray-400 to-zinc-400",
  icon: <User className="w-3.5 h-3.5" />,
  label: "User",
  badgeClass: "bg-muted text-muted-foreground border-border",
  avatarRing: "ring-2 ring-muted-foreground/30",
};

const UserProfileCard = ({ userId, isOnline, children }: UserProfileCardProps) => {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["profile-card", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, avatar_url, status")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const { data: role } = useQuery({
    queryKey: ["profile-card-role", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.role ?? null;
    },
    enabled: !!userId,
  });

  const { data: engineer } = useQuery({
    queryKey: ["profile-card-engineer", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("specialty, rating, jobs_completed, location, insurance_details, vehicle_number_plate, skills, hourly_rate")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: role === "engineer",
  });

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const rc = ROLE_CONFIG[role ?? ""] ?? DEFAULT_ROLE_CONFIG;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 overflow-hidden rounded-xl shadow-lg border-0 animate-scale-in" side="right" align="start">
        {profile ? (
          <div>
            {/* Colored banner header — slides down */}
            <div className={`relative ${rc.gradient} px-4 pt-5 pb-8 animate-[slideDown_0.35s_ease-out]`}>
              {/* Decorative pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-1 right-2 w-16 h-16 rounded-full border-2 border-white/40 animate-[expandCircle_0.6s_ease-out_0.2s_both]" />
                <div className="absolute -bottom-3 -left-3 w-20 h-20 rounded-full border-2 border-white/30 animate-[expandCircle_0.6s_ease-out_0.35s_both]" />
              </div>
              <div className="relative flex items-center gap-1.5 text-white/90 animate-fade-in" style={{ animationDelay: "0.15s", animationFillMode: "both" }}>
                {rc.icon}
                <span className="text-[11px] font-semibold tracking-wide uppercase">{rc.label}</span>
              </div>
            </div>

            {/* Avatar overlapping banner — pops in */}
            <div className="px-4 -mt-6 relative z-10 animate-[popIn_0.3s_ease-out_0.15s_both]">
              <div className="flex items-end gap-3">
                <div className="relative">
                  <Avatar className={`w-14 h-14 border-[3px] border-background shadow-md ${rc.avatarRing} transition-transform duration-200 hover:scale-110`}>
                    <AvatarFallback className="bg-background text-foreground font-bold text-base">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {isOnline !== undefined && (
                    <PresenceDot isOnline={isOnline} size="md" className="absolute -bottom-0.5 -right-0.5 border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-sm font-bold truncate text-foreground">{profile.full_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${rc.badgeClass}`}>
                      {rc.label}
                    </Badge>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                      profile.status === "active" ? "text-emerald-500" : "text-muted-foreground"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${profile.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                      {profile.status === "active" ? "Active" : profile.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact info — fades in staggered */}
            <div className="px-4 pt-3 pb-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: "0.25s", animationFillMode: "both" }}>
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{profile.phone}</span>
                </div>
              )}
            </div>

            {/* Engineer-specific details — fades in */}
            {role === "engineer" && engineer && (
              <div className="border-t px-4 py-3 space-y-2 bg-muted/30 animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
                <div className="flex items-center gap-2 text-xs">
                  <Wrench className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">{engineer.specialty}</span>
                </div>
                {engineer.location && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{engineer.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    {engineer.rating ? Number(engineer.rating).toFixed(1) : "N/A"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {engineer.jobs_completed ?? 0} jobs
                  </span>
                </div>

                {engineer.insurance_details && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      <span className="font-medium text-foreground text-[11px]">Insurance</span>
                      <p className="mt-0.5">{engineer.insurance_details}</p>
                    </div>
                  </div>
                )}

                {engineer.vehicle_number_plate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Car className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground text-[11px]">Vehicle</span>
                      <span className="font-mono bg-background px-1.5 py-0.5 rounded text-[11px] border">
                        {engineer.vehicle_number_plate}
                      </span>
                    </div>
                  </div>
                )}

                {engineer.skills && engineer.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {engineer.skills.slice(0, 5).map((skill: string, i: number) => (
                      <Badge key={skill} variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-background animate-fade-in" style={{ animationDelay: `${0.35 + i * 0.05}s`, animationFillMode: "both" }}>
                        {skill}
                      </Badge>
                    ))}
                    {engineer.skills.length > 5 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-background">
                        +{engineer.skills.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick actions — slides up */}
            <div className="border-t px-3 py-2.5 flex gap-2 animate-fade-in" style={{ animationDelay: "0.35s", animationFillMode: "both" }}>
              <Button
                size="sm"
                variant="default"
                className="flex-1 h-8 text-xs gap-1.5 transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                onClick={() => navigate("/internal-chat")}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send Message
              </Button>
              {role === "engineer" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs gap-1.5 transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                  onClick={() => navigate("/engineers")}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Profile
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Skeleton banner */}
            <Skeleton className="h-[72px] w-full rounded-none" />
            {/* Skeleton avatar + name */}
            <div className="px-4 -mt-6 relative z-10 flex items-end gap-3">
              <Skeleton className="w-14 h-14 rounded-full border-[3px] border-background shrink-0" />
              <div className="flex-1 pb-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            </div>
            {/* Skeleton contact rows */}
            <div className="px-4 pt-3 pb-3 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            {/* Skeleton action buttons */}
            <div className="border-t px-3 py-2.5 flex gap-2">
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 flex-1 rounded-md" />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default UserProfileCard;
