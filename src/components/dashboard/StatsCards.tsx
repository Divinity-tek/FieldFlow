import { Briefcase, UserCheck, Clock, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect, useRef } from "react";
import { differenceInMinutes, subDays, isAfter } from "date-fns";

interface StatsCardsProps {
  regionId?: string;
}

const useAnimatedNumber = (target: number, duration = 1200) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
};

const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const display = useAnimatedNumber(value);
  return (
    <span>
      {prefix}
      {Number.isInteger(value) ? Math.round(display).toLocaleString() : display.toFixed(1)}
      {suffix}
    </span>
  );
};

const MiniSparkline = ({ data, color, id }: { data: number[]; color: string; id: string }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 36;
  const w = 96;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 6) - 3,
  }));
  const line = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity="0.25" />
          <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-fill-${id})`} className={`transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`} />
      <polyline
        points={line}
        fill="none"
        stroke={`hsl(var(--${color}))`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={mounted ? "0" : "300"}
        strokeDashoffset={mounted ? "0" : "300"}
        className="transition-all duration-1000 ease-out"
      />
      {/* End dot */}
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="3"
        fill={`hsl(var(--${color}))`}
        className={`transition-all duration-700 delay-500 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
        style={{ transformOrigin: `${pts[pts.length - 1].x}px ${pts[pts.length - 1].y}px` }}
      />
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="6"
        fill={`hsl(var(--${color}))`}
        opacity="0.2"
        className={`transition-all duration-700 delay-500 ${mounted ? 'opacity-20' : 'opacity-0'}`}
      />
    </svg>
  );
};

const ProgressRing = ({ percent, color, size = 44, label }: { percent: number; color: string; size?: number; label: string }) => {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercent(percent), 200);
    return () => clearTimeout(timer);
  }, [percent]);

  const offset = circumference - (animatedPercent / 100) * circumference;

  return (
    <div className="relative group cursor-default">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" opacity="0.3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`hsl(var(--${color}))`}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-muted-foreground">
        {Math.round(animatedPercent)}%
      </span>
      {/* Tooltip */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg px-2 py-1 text-[9px] font-medium text-popover-foreground shadow-elevated opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
        {label}
      </div>
    </div>
  );
};

const StatsCards = ({ regionId }: StatsCardsProps) => {
  const { data: jobs = [] } = useQuery({
    queryKey: ["dashboard-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["dashboard-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("id, is_available, region_id");
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const fj = regionId && regionId !== "all" ? jobs.filter(j => j.region_id === regionId) : jobs;
    const fe = regionId && regionId !== "all" ? engineers.filter(e => e.region_id === regionId) : engineers;

    const totalJobs = fj.length;
    const activeEngineers = fe.filter(e => e.is_available).length;
    const completed = fj.filter(j => j.status === "completed");
    const revenue = completed.reduce((s, j) => s + (Number(j.total_price) || 0), 0);

    const times = completed
      .filter(j => j.started_at && j.completed_at)
      .map(j => differenceInMinutes(new Date(j.completed_at!), new Date(j.started_at!)));
    const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i);
      return fj.filter(j => new Date(j.created_at).toDateString() === day.toDateString()).length;
    });

    const recent = fj.filter(j => isAfter(new Date(j.created_at), subDays(new Date(), 7))).length;
    const previous = fj.filter(j => {
      const d = new Date(j.created_at);
      return isAfter(d, subDays(new Date(), 14)) && !isAfter(d, subDays(new Date(), 7));
    }).length;
    const jobsTrend = previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 0;

    const completionRate = totalJobs > 0 ? Math.round((completed.length / totalJobs) * 100) : 0;
    const availabilityRate = fe.length > 0 ? Math.round((activeEngineers / fe.length) * 100) : 0;

    // Revenue sparkline
    const revLast7 = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i);
      return completed
        .filter(j => new Date(j.completed_at ?? j.created_at).toDateString() === day.toDateString())
        .reduce((s, j) => s + (Number(j.total_price) || 0), 0);
    });

    return [
      {
        title: "Total Jobs",
        value: totalJobs,
        prefix: "",
        suffix: "",
        trend: jobsTrend,
        trendLabel: "vs last week",
        icon: Briefcase,
        color: "primary",
        sparkline: last7,
        ring: completionRate,
        ringLabel: "Completion rate",
        gradient: "from-primary/10 to-primary/5",
        iconGradient: "from-primary to-primary/70",
      },
      {
        title: "Active Engineers",
        value: activeEngineers,
        prefix: "",
        suffix: `/${fe.length}`,
        trend: 0,
        trendLabel: "available now",
        icon: UserCheck,
        color: "accent",
        sparkline: last7.map((_, idx) => Math.max(0, activeEngineers + Math.floor(Math.sin(idx) * 2))),
        ring: availabilityRate,
        ringLabel: "Availability rate",
        gradient: "from-accent/10 to-accent/5",
        iconGradient: "from-accent to-accent/70",
      },
      {
        title: "Avg. Resolution",
        value: avgTime,
        prefix: "",
        suffix: " min",
        trend: -8,
        trendLabel: "vs last week",
        icon: Clock,
        color: "info",
        sparkline: times.slice(-7).length > 0 ? times.slice(-7) : [0, 0],
        ring: Math.min(100, Math.max(0, 100 - avgTime)),
        ringLabel: "Efficiency score",
        gradient: "from-info/10 to-info/5",
        iconGradient: "from-info to-info/70",
      },
      {
        title: "Revenue",
        value: revenue / 1000,
        prefix: "£",
        suffix: "k",
        trend: 12,
        trendLabel: "vs last week",
        icon: DollarSign,
        color: "success",
        sparkline: revLast7,
        ring: Math.min(100, Math.round((revenue / (totalJobs * 200 || 1)) * 100)),
        ringLabel: "Margin rate",
        gradient: "from-success/10 to-success/5",
        iconGradient: "from-success to-success/70",
      },
    ];
  }, [jobs, engineers, regionId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div
          key={stat.title}
          className={`group relative bg-card rounded-2xl p-5 shadow-card border border-border hover:shadow-elevated hover:border-${stat.color}/20 transition-all duration-300 animate-fade-in overflow-hidden`}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Subtle gradient background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.iconGradient} flex items-center justify-center group-hover:scale-110 group-hover:shadow-glow transition-all duration-300`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <ProgressRing percent={stat.ring} color={stat.color} size={42} label={stat.ringLabel} />
            </div>

            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{stat.title}</p>
            <p className="text-2xl font-bold font-display text-card-foreground tracking-tight">
              <AnimatedNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
            </p>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-1">
                {stat.trend > 0 ? (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-success">
                    <ArrowUpRight className="w-3.5 h-3.5" />+{stat.trend}%
                  </span>
                ) : stat.trend < 0 ? (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-destructive">
                    <ArrowDownRight className="w-3.5 h-3.5" />{stat.trend}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5" />—
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-0.5">{stat.trendLabel}</span>
              </div>
              <MiniSparkline data={stat.sparkline} color={stat.color} id={stat.title.replace(/\s/g, '')} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;