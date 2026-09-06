import {
  Clock, CheckCircle, Shield, MapPin, Zap, TrendingUp, FileText, Users,
  Star, Sparkles, Globe, Wrench, Briefcase, Hand, HandMetal, Grab, BarChart3,
  Network, Cable, Server, Wallet, Route, Cpu, type LucideIcon,
} from "lucide-react";

export const PROOF_POINT_ICONS: Record<string, LucideIcon> = {
  Clock, CheckCircle, Shield, MapPin, Zap, TrendingUp, FileText, Users,
  Star, Sparkles, Globe, Wrench, Briefcase, Hand, HandMetal, Grab, BarChart3,
  Network, Cable, Server, Wallet, Route, Cpu,
};

export const PROOF_POINT_ICON_NAMES = Object.keys(PROOF_POINT_ICONS);

export function getProofPointIcon(name: string): LucideIcon {
  return PROOF_POINT_ICONS[name] ?? TrendingUp;
}
