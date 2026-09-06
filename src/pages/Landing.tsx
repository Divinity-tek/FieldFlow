import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import LandingChatWidget from "@/components/chat/LandingChatWidget";
import heroEngineerRouter from "@/assets/hero-engineer-router.jpg";
import FieldFlowMark from "@/components/branding/FieldFlowMark";
import { useProofPoints } from "@/hooks/useProofPoints";
import { getProofPointIcon } from "@/lib/proofPointIcons";
import { DispatchQuoteForm } from "@/components/landing/DispatchQuoteForm";
const trackRoiEvent = (_event: string, _data?: Record<string, unknown>) => {};

const FALLBACK_PROOF_POINTS = [
  { icon: "Clock", value: "−68%", label: "Avg dispatch time", sub: "Smart-hands ticket to engineer en-route" },
  { icon: "CheckCircle", value: "98.4%", label: "First-time fix rate", sub: "L1/L2 jobs closed on first site visit" },
  { icon: "Shield", value: "99.2%", label: "SLA compliance", sub: "4-hour, NBD and same-day SLAs hit" },
  { icon: "MapPin", value: "190+", label: "Countries covered", sub: "Vetted L1, L2 and L3 engineers on the ground" },
  { icon: "Zap", value: "< 2 hrs", label: "Mean time to on-site", sub: "Major metros for critical incidents" },
  { icon: "TrendingUp", value: "4.92 / 5", label: "Client satisfaction", sub: "Post-job CSAT for hands & feet visits" },
  { icon: "FileText", value: "100%", label: "Photo-evidenced handover", sub: "Signed reports with site photos every job" },
  { icon: "Users", value: "12,000+", label: "Certified field engineers", sub: "CCNA / CCNP / JNCIA / Fortinet NSE pool" },
];
import {
  Briefcase, Zap, Shield, BarChart3, MapPin, Users, ArrowRight,
  CheckCircle, Globe, Clock, Star, Sparkles,
  ArrowUpRight, Cpu, Route, Wallet, FileText,
  Lock, Headphones, TrendingUp, ChevronRight, Play,
  Network, Cable, Warehouse, Wrench, Building2, Plane, Hotel, Factory, Landmark, ShoppingBag, Truck,
  Hand, Footprints, HandMetal, Grab,
  Replace, PackageSearch, ShieldCheck, Recycle, Languages, Boxes, ClipboardCheck, Server, Plug, X,
  Calculator, DollarSign, Timer, TrendingDown,
} from "lucide-react";

/* ── animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/* ── data ── */
const features = [
  { icon: MapPin, title: "Real-Time Tracking", desc: "GPS-powered live tracking with geofence alerts, ETAs, and automated arrival notifications.", accent: "primary" },
  { icon: Zap, title: "AI-Powered Dispatch", desc: "Intelligent scheduling that matches jobs to engineers based on skills, proximity, and history.", accent: "accent" },
  { icon: Shield, title: "SLA Compliance", desc: "Automated breach detection with escalation workflows and real-time compliance dashboards.", accent: "primary" },
  { icon: BarChart3, title: "Advanced Analytics", desc: "Revenue forecasting, performance scorecards, operational KPIs, and exportable reports.", accent: "accent" },
  { icon: Users, title: "CRM & Pipeline", desc: "Full client lifecycle — communications, lead stages, follow-ups, and satisfaction tracking.", accent: "primary" },
  { icon: Globe, title: "Multi-Region Operations", desc: "Timezone-aware scheduling, localised pricing, and regional dashboards for global teams.", accent: "accent" },
];

const stats = [
  { value: "99.9%", label: "Platform Uptime", icon: Shield },
  { value: "2.4s", label: "Avg Dispatch Time", icon: Clock },
  { value: "50k+", label: "Jobs Processed", icon: Route },
  { value: "4.9", label: "Customer Rating", suffix: "/5", icon: Star },
];

const testimonials = [
  { name: "Sarah Mitchell", role: "Operations Director", company: "TechServ UK", quote: "Response times dropped 40% in month one. The AI dispatch alone transformed our operations.", avatar: "SM" },
  { name: "James Chen", role: "Chief Executive Officer", company: "QuickFix Pro", quote: "Engineers are 60% more productive. We scaled from 20 to 80 field staff without adding management.", avatar: "JC" },
  { name: "Emma Thompson", role: "Regional Manager", company: "ServiceFirst", quote: "Finally a platform built for enterprise field service — not a retrofitted project tool.", avatar: "ET" },
];

const workflow = [
  { step: "01", title: "Create Request", desc: "Client submits a service request or your team creates a job with full SOW details.", icon: FileText },
  { step: "02", title: "AI Dispatch", desc: "The platform matches the optimal engineer based on skills, proximity, and workload.", icon: Cpu },
  { step: "03", title: "Live Execution", desc: "Track progress in real-time with GPS, status updates, photos, and voice notes.", icon: MapPin },
  { step: "04", title: "Invoice & Settle", desc: "Auto-generate invoices, collect signatures, and process payments seamlessly.", icon: Wallet },
];

const capabilities = [
  "Dispatch Ticket Management with SOW",
  "Digital Signatures & Estimates",
  "Engineer Scorecard & Ratings",
  "Inventory & Asset Lifecycle",
  "Knowledge Base & Help System",
  "Wallet & Payment Processing",
  "Site Surveys with Photo Annotations",
  "Recurring Job Automation",
];

const logos = ["TechServ", "QuickFix", "ServiceFirst", "FieldPro", "FixIt Group", "EliteTech", "MetroCare", "NorthStar"];

const services = [
  { icon: Wrench, title: "Field Services", desc: "Network infrastructure hands & feet support across LAN, WAN and backbone networks. Certified L1, L2 and L3 engineers dispatched worldwide." },
  { icon: Truck, title: "Distribution & Logistics", desc: "Door-to-door equipment delivery, customs brokerage, and last-mile shipping coordination." },
  { icon: Warehouse, title: "Warehousing & Asset Mgmt", desc: "Short to long-term stocking, staging, RMA returns and global inventory management." },
  { icon: Cpu, title: "Solutions Architecture", desc: "Plan, design, implement and operate ICT solutions worldwide with our coordinator network." },
  { icon: Briefcase, title: "Managed Services", desc: "Hardware, software, installation and maintenance bundled in a single monthly fee." },
  { icon: Network, title: "Network Infrastructure Hands & Feet", desc: "L1, L2 and L3 on-site support for routers, switches, firewalls and wireless across multi-vendor stacks: Cisco, Fortinet, Juniper, Palo Alto, Aruba." },
  { icon: Hand, title: "L1 Hands & Feet — On-Site Smart Hands", desc: "Physical tasks under remote guidance: rack & stack, cabling, patching, device reboots, LED checks, media swaps, parts replacement and shipping coordination. No configuration required." },
  { icon: HandMetal, title: "L2 Hands & Feet — Field Technician", desc: "Certified technicians performing installs, IMAC/D, basic configuration from runbooks, firmware upgrades, cable certification, fault isolation, RMA execution and structured handover with photo evidence." },
  { icon: Grab, title: "L3 Hands & Feet — Senior Network Engineer", desc: "Expert engineers for complex troubleshooting, design changes, BGP/OSPF/MPLS, SD-WAN/SASE cutovers, firewall policy work, root-cause analysis and on-site escalation alongside your NOC or vendor TAC." },
  { icon: Shield, title: "Maintenance & Support", desc: "SLA-based post-implementation support to ensure business continuity and resilience." },
  { icon: Cable, title: "Data Connectivity", desc: "MPLS, dedicated internet, fiber, leased lines, 4G/5G — sourced and managed end-to-end." },
  { icon: Replace, title: "IMAC/D Services", desc: "Install, Move, Add, Change & Decommission — structured change execution at any site, any country." },
  { icon: Headphones, title: "Smart Hands & Remote Hands", desc: "24/7 on-demand technicians for cabling, reboots, swaps, and remote-eyes troubleshooting in colos & data centers." },
  { icon: PackageSearch, title: "Hardware Procurement & Sparing", desc: "Multi-vendor sourcing, spares pooling and forward stocking locations (FSL) close to your sites." },
  { icon: ShieldCheck, title: "Customs, IOR & EOR", desc: "Importer/Exporter of Record, customs clearance and trade compliance across 190+ countries." },
  { icon: Server, title: "Staging & Configuration Labs", desc: "Pre-deployment imaging, burn-in, asset tagging and kitting before zero-touch on-site rollout." },
  { icon: Languages, title: "Multilingual NOC & Service Desk", desc: "Follow-the-sun L1/L2/L3 support in 20+ languages with ITIL incident & change management." },
  { icon: Plug, title: "Multi-OEM Vendor Support", desc: "Vendor-neutral coverage for Cisco, Fortinet, Juniper, Aruba, Palo Alto, Versa, Meraki, HPE and more." },
  { icon: ClipboardCheck, title: "Site Surveys & Audits", desc: "Pre-deployment site assessments, low-voltage surveys, photo-documented readiness reports." },
  { icon: Recycle, title: "Decommissioning & ITAD", desc: "Secure decommission, data sanitization, WEEE-compliant recycling and certified asset disposition." },
  { icon: Boxes, title: "Spare Parts Depot & FSL", desc: "Global spares network with 4-hour, NBD and same-day SLA replenishment from regional depots." },
];

const industries = [
  { icon: Plane, label: "Telecom & Carriers" },
  { icon: Hotel, label: "Hospitality" },
  { icon: Factory, label: "Energy & Oil/Gas" },
  { icon: Landmark, label: "Government" },
  { icon: ShoppingBag, label: "Retail & Banking" },
  { icon: Building2, label: "Enterprise" },
];

const caseStudies = [
  { vertical: "Telecoms & Carriers", title: "Network overhaul for a multinational telecom", body: "Delivered and installed 3,000+ devices across 1,000+ sites in 18 months.", metric: "1,000+ sites" },
  { vertical: "Systems Integrators", title: "Global FMCG beverage manufacturer", body: "Qualified engineers dispatched at short notice across 4 continents with last-minute change tolerance.", metric: "40+ countries" },
  { vertical: "Government", title: "Connectivity for a Gulf-state Foreign Ministry", body: "1,000+ devices installed at 53 diplomatic sites worldwide with white-glove handover.", metric: "53 missions" },
  { vertical: "Energy", title: "3G/4G router rollout for a major oil company", body: "Trained engineers installed routers under 1 hour at ~900 Shell sites across Europe.", metric: "900 sites" },
  { vertical: "Hospitality", title: "Lightning-fast network maintenance for hotels", body: "On-call engineers servicing 530+ branded hotels across 78 countries on six continents.", metric: "78 countries" },
  { vertical: "APAC Aviation", title: "Airport connectivity in APAC", body: "Partnered with Tata Communications to deliver global airline connectivity across hub airports.", metric: "Tier-1 airline" },
];

/* ── animated counter ── */
function AnimatedCounter({ target }: { target: string }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const num = parseFloat(target.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) { setDisplay(target); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const duration = 1400;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = eased * num;
        setDisplay(num >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));
        if (p < 1) requestAnimationFrame(tick);
        else setDisplay(target);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <div ref={ref}>{display}</div>;
}

/* spotlight handler */
function useSpotlight() {
  return (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
}

/* ── page ── */
const Landing = () => {
  const spotlight = useSpotlight();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const { data: proofPointsData } = useProofPoints();
  const proofPoints = proofPointsData ?? [];

  // ── ROI calculator state ──
  const [roiL1, setRoiL1] = useState(40);
  const [roiL2, setRoiL2] = useState(20);
  const [roiL3, setRoiL3] = useState(8);
  const [roiLegacyL1, setRoiLegacyL1] = useState(180);
  const [roiLegacyL2, setRoiLegacyL2] = useState(280);
  const [roiLegacyL3, setRoiLegacyL3] = useState(450);
  // FieldFlow blended hourly rates (USD) — typical marketplace pricing
  const ffL1 = 95, ffL2 = 165, ffL3 = 285;
  // Avg dispatch hours saved per ticket (legacy ~6h vs ~1.9h)
  const dispatchSavedHours = 4.1;
  const monthlyJobs = roiL1 + roiL2 + roiL3;
  const legacyMonthly = roiL1 * roiLegacyL1 + roiL2 * roiLegacyL2 + roiL3 * roiLegacyL3;
  const ffMonthly = roiL1 * ffL1 + roiL2 * ffL2 + roiL3 * ffL3;
  const monthlySavings = Math.max(0, legacyMonthly - ffMonthly);
  const annualSavings = monthlySavings * 12;
  const savingsPct = legacyMonthly > 0 ? Math.round((monthlySavings / legacyMonthly) * 100) : 0;
  const dispatchHoursSavedMonth = Math.round(monthlyJobs * dispatchSavedHours);
  const fmtUSD = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // ── Prefill ROI calculator from the dispatch quote form, then scroll to #roi ──
  const [roiPrefilled, setRoiPrefilled] = useState<null | { level: string; sla: string }>(null);
  const roiPrefillChipRef = useRef<HTMLDivElement | null>(null);
  const roiHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const handleEstimateSavings = () => {
    const form = document.getElementById("dispatch-quote-form") as HTMLFormElement | null;
    // Sensible defaults if the user hasn't touched the form yet.
    let level = "L1";
    let sla = "next_business_day";
    let duration = "2_4h";
    if (form) {
      const fd = new FormData(form);
      level = (fd.get("service_level") as string) || level;
      sla = (fd.get("sla") as string) || sla;
      duration = (fd.get("duration_estimate") as string) || duration;
    }
    // Distribute monthly tickets toward the selected service level.
    // Bump total volume for tighter SLAs (more reactive work) and longer durations.
    const slaMultiplier: Record<string, number> = {
      p1_4h: 1.6, same_day: 1.3, next_business_day: 1.0, "48_72h": 0.85, scheduled: 0.7,
    };
    const durBumpL3: Record<string, number> = {
      lt_1h: 0.7, "1_2h": 0.85, "2_4h": 1.0, half_day: 1.15, full_day: 1.3, multi_day: 1.5,
    };
    const baseTotal = 70;
    const total = Math.round(baseTotal * (slaMultiplier[sla] ?? 1));
    let l1 = 10, l2 = 10, l3 = 5;
    if (level === "L1") { l1 = total - 15; l2 = 10; l3 = 5; }
    else if (level === "L2") { l1 = 15; l2 = total - 25; l3 = 10; }
    else if (level === "L3") { l1 = 10; l2 = 15; l3 = Math.round((total - 25) * (durBumpL3[duration] ?? 1)); }
    setRoiL1(Math.max(0, Math.min(500, l1)));
    setRoiL2(Math.max(0, Math.min(300, l2)));
    setRoiL3(Math.max(0, Math.min(200, l3)));
    // Tighter SLAs typically command a premium from legacy vendors — bump rates accordingly.
    const rateBump = sla === "p1_4h" ? 1.35 : sla === "same_day" ? 1.15 : 1.0;
    setRoiLegacyL1(Math.round(180 * rateBump));
    setRoiLegacyL2(Math.round(280 * rateBump));
    setRoiLegacyL3(Math.round(450 * rateBump));
    setRoiPrefilled({ level, sla });
    // Analytics — landing-page funnel entry into the ROI calculator.
    void trackRoiEvent("estimate_savings_clicked", {
      service_level: level, sla, duration, source: "landing_inline_roi",
    });
    // Defer scroll across two animation frames so React can render the chip and
    // the browser can lay it out — then measure its real height (it may wrap to
    // multiple lines on narrow viewports) and offset by sticky bar + chip + gap.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById("roi");
        if (!target) return;
        const styles = getComputedStyle(document.documentElement);
        const stickyBar = parseInt(styles.getPropertyValue("--sticky-cta-h")) || 0;
        const chipEl = roiPrefillChipRef.current;
        // Measure the actual rendered chip height (incl. its top/bottom margins)
        // so the offset adapts to wrap, font size, and zoom on every screen size.
        let chipHeight = 0;
        if (chipEl) {
          const rect = chipEl.getBoundingClientRect();
          const cs = getComputedStyle(chipEl);
          const mt = parseFloat(cs.marginTop) || 0;
          const mb = parseFloat(cs.marginBottom) || 0;
          chipHeight = Math.ceil(rect.height + mt + mb);
        }
        const breathingRoom = 16;
        const offset = stickyBar + chipHeight + breathingRoom;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion ? "auto" : "smooth" });

        // Move focus to the calculator heading once the smooth scroll settles,
        // so screen readers and keyboard users land on the section. We poll
        // scroll position because there's no reliable "scrollend" event yet.
        const focusHeading = () => {
          const h = roiHeadingRef.current;
          if (!h) return;
          // preventScroll keeps our computed offset intact (no jump-to-top from focus).
          h.focus({ preventScroll: true });
        };
        if (prefersReducedMotion) {
          focusHeading();
        } else {
          let lastY = window.scrollY;
          let stableFrames = 0;
          const start = performance.now();
          const tick = () => {
            const y = window.scrollY;
            stableFrames = Math.abs(y - lastY) < 0.5 ? stableFrames + 1 : 0;
            lastY = y;
            if (stableFrames >= 3 || performance.now() - start > 1200) {
              focusHeading();
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    });
  };


  useEffect(() => {
    const root = document.documentElement;
    // Initialize CSS vars: bar height + current reserved spacer height.
    // Using a CSS variable lets the spacer transition via pure CSS (no JS-driven layout per frame).
    root.style.setProperty("--sticky-cta-bar-h", "56px");
    root.style.setProperty("--sticky-cta-h", "0px");

    const onScroll = () => {
      const heroEl = heroRef.current;
      // Trigger right after the hero section's bottom edge passes the top of viewport.
      const threshold = heroEl ? heroEl.offsetTop + heroEl.offsetHeight - 80 : 720;
      const visible = window.scrollY > threshold;
      setShowStickyCTA(visible);
      root.style.setProperty(
        "--sticky-cta-h",
        visible ? "var(--sticky-cta-bar-h)" : "0px"
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.style.removeProperty("--sticky-cta-h");
      root.style.removeProperty("--sticky-cta-bar-h");
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => { if (!hadDark) root.classList.remove("dark"); };
  }, []);

  // aria-describedby-driven error highlighting:
  // when a form control is aria-invalid, mark its associated label (label[for])
  // and any element referenced via aria-describedby with data-error so they
  // pick up the destructive styles defined on the root container.
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const CONTROL_SEL =
      'input,textarea,select,[role=combobox],[role=checkbox],[role=radio],[role=switch]';
    const MARK = "data-error-driven";

    const sync = () => {
      root.querySelectorAll(`[${MARK}]`).forEach((el) => {
        el.removeAttribute("data-error");
        el.removeAttribute(MARK);
      });

      root.querySelectorAll<HTMLElement>(CONTROL_SEL).forEach((ctrl) => {
        if (ctrl.getAttribute("aria-invalid") !== "true") return;

        const id = ctrl.id;
        if (id) {
          root
            .querySelectorAll<HTMLElement>(`label[for="${CSS.escape(id)}"]`)
            .forEach((lbl) => {
              if (!lbl.hasAttribute("data-error")) {
                lbl.setAttribute("data-error", "");
                lbl.setAttribute(MARK, "");
              }
            });
        }

        const describedBy = ctrl.getAttribute("aria-describedby");
        if (describedBy) {
          describedBy.split(/\s+/).filter(Boolean).forEach((tid) => {
            const target = root.querySelector<HTMLElement>(`#${CSS.escape(tid)}`);
            if (target && !target.hasAttribute("data-error")) {
              target.setAttribute("data-error", "");
              target.setAttribute(MARK, "");
            }
          });
        }
      });
    };

    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-invalid", "aria-describedby", "for", "id"],
    });
    return () => mo.disconnect();
  }, []);

  return (
    <div ref={pageRef} className="dark relative isolate min-h-screen overflow-hidden bg-transparent text-foreground [&_p]:leading-[1.6] [&_p]:tracking-[-0.005em] [&_li]:leading-[1.6] [&_li]:tracking-[-0.005em] [&_ul]:space-y-2 [&_ol]:space-y-2 [&_button]:tracking-[-0.005em] [&_button]:leading-none [&_a]:tracking-[-0.005em] [&_a]:leading-[1.5] [&_label]:tracking-[-0.005em] [&_label]:leading-[1.4] [&_small]:tracking-[0] [&_small]:leading-[1.5] [&_.text-xs]:tracking-[0] [&_.text-xs]:leading-[1.5] [&_.text-sm]:tracking-[-0.005em] [&_.text-sm]:leading-[1.55] [&_[data-badge]]:tracking-[0] [&_[data-badge]]:leading-none [&_.badge]:tracking-[0] [&_.badge]:leading-none [&_input]:tracking-[-0.005em] [&_input]:leading-[1.5] [&_textarea]:tracking-[-0.005em] [&_textarea]:leading-[1.55] [&_input::placeholder]:tracking-[-0.005em] [&_input::placeholder]:leading-[1.5] [&_textarea::placeholder]:tracking-[-0.005em] [&_textarea::placeholder]:leading-[1.55] [&_[data-helper]]:tracking-[0] [&_[data-helper]]:leading-[1.5] [&_[data-helper]]:text-xs [&_[data-error]]:tracking-[0] [&_[data-error]]:leading-[1.5] [&_[data-error]]:text-xs [&_[role=alert]]:tracking-[0] [&_[role=alert]]:leading-[1.5] [&_h1]:tracking-[-0.025em] [&_h1]:leading-[1.05] [&_h1]:mb-6 [&_h2]:tracking-[-0.02em] [&_h2]:leading-[1.15] [&_h2]:mb-4 [&_h3]:tracking-[-0.015em] [&_h3]:leading-[1.25] [&_h3]:mb-3 [&_label:has(+_:focus)]:tracking-[-0.005em] [&_label:has(+_:focus)]:leading-[1.4] [&_label:has(+_:disabled)]:tracking-[-0.005em] [&_label:has(+_:disabled)]:leading-[1.4] [&_label:has(+_:disabled)]:opacity-60 [&_label[data-error]]:tracking-[0] [&_label[data-error]]:leading-[1.4] [&_label[data-error]]:text-xs [&_label[data-invalid]]:tracking-[0] [&_label[data-invalid]]:leading-[1.4] [&_label[data-invalid]]:text-xs [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring [&_input]:focus-visible:ring-offset-2 [&_input]:focus-visible:ring-offset-background [&_input]:focus-visible:border-ring [&_textarea]:focus-visible:outline-none [&_textarea]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-ring [&_textarea]:focus-visible:ring-offset-2 [&_textarea]:focus-visible:ring-offset-background [&_textarea]:focus-visible:border-ring [&_select]:focus-visible:outline-none [&_select]:focus-visible:ring-2 [&_select]:focus-visible:ring-ring [&_select]:focus-visible:ring-offset-2 [&_select]:focus-visible:ring-offset-background [&_select]:focus-visible:border-ring [&_[role=combobox]]:focus-visible:ring-2 [&_[role=combobox]]:focus-visible:ring-ring [&_[role=combobox]]:focus-visible:ring-offset-2 [&_[role=combobox]]:focus-visible:ring-offset-background [&_input[aria-invalid=true]]:focus-visible:ring-2 [&_input[aria-invalid=true]]:focus-visible:ring-destructive [&_input[aria-invalid=true]]:focus-visible:ring-offset-2 [&_input[aria-invalid=true]]:focus-visible:ring-offset-background [&_input[aria-invalid=true]]:focus-visible:border-destructive [&_input[data-error]]:focus-visible:ring-2 [&_input[data-error]]:focus-visible:ring-destructive [&_input[data-error]]:focus-visible:ring-offset-2 [&_input[data-error]]:focus-visible:ring-offset-background [&_input[data-error]]:focus-visible:border-destructive [&_textarea[aria-invalid=true]]:focus-visible:ring-2 [&_textarea[aria-invalid=true]]:focus-visible:ring-destructive [&_textarea[aria-invalid=true]]:focus-visible:ring-offset-2 [&_textarea[aria-invalid=true]]:focus-visible:ring-offset-background [&_textarea[aria-invalid=true]]:focus-visible:border-destructive [&_textarea[data-error]]:focus-visible:ring-2 [&_textarea[data-error]]:focus-visible:ring-destructive [&_textarea[data-error]]:focus-visible:ring-offset-2 [&_textarea[data-error]]:focus-visible:ring-offset-background [&_textarea[data-error]]:focus-visible:border-destructive [&_select[aria-invalid=true]]:focus-visible:ring-2 [&_select[aria-invalid=true]]:focus-visible:ring-destructive [&_select[aria-invalid=true]]:focus-visible:ring-offset-2 [&_select[aria-invalid=true]]:focus-visible:ring-offset-background [&_select[aria-invalid=true]]:focus-visible:border-destructive [&_[role=combobox][aria-invalid=true]]:focus-visible:ring-2 [&_[role=combobox][aria-invalid=true]]:focus-visible:ring-destructive [&_[role=combobox][aria-invalid=true]]:focus-visible:ring-offset-2 [&_[role=combobox][aria-invalid=true]]:focus-visible:ring-offset-background [&_label[data-error]]:text-destructive [&_label[data-invalid]]:text-destructive [&_label[aria-invalid=true]]:text-destructive [&_[data-helper][data-error]]:text-destructive [&_[data-error]]:text-destructive [&_[role=alert]]:text-destructive [&_label:has(+_input[aria-invalid=true])]:text-destructive [&_label:has(+_textarea[aria-invalid=true])]:text-destructive [&_label:has(+_select[aria-invalid=true])]:text-destructive [&_label:has(+_[role=combobox][aria-invalid=true])]:text-destructive [&_label:has(+_input[data-error])]:text-destructive [&_label:has(+_textarea[data-error])]:text-destructive [&_label:has(+_select[data-error])]:text-destructive [&_:has(>_input[aria-invalid=true]:focus-visible)_label]:text-destructive [&_:has(>_textarea[aria-invalid=true]:focus-visible)_label]:text-destructive [&_:has(>_select[aria-invalid=true]:focus-visible)_label]:text-destructive [&_:has(>_input[aria-invalid=true]:focus-visible)_[data-helper]]:text-destructive [&_:has(>_textarea[aria-invalid=true]:focus-visible)_[data-helper]]:text-destructive [&_:has(input[aria-invalid=true]:focus-visible)_label]:text-destructive [&_:has(textarea[aria-invalid=true]:focus-visible)_label]:text-destructive [&_[role=checkbox]]:focus-visible:outline-none [&_[role=checkbox]]:focus-visible:ring-2 [&_[role=checkbox]]:focus-visible:ring-ring [&_[role=checkbox]]:focus-visible:ring-offset-2 [&_[role=checkbox]]:focus-visible:ring-offset-background [&_[role=radio]]:focus-visible:outline-none [&_[role=radio]]:focus-visible:ring-2 [&_[role=radio]]:focus-visible:ring-ring [&_[role=radio]]:focus-visible:ring-offset-2 [&_[role=radio]]:focus-visible:ring-offset-background [&_[role=switch]]:focus-visible:outline-none [&_[role=switch]]:focus-visible:ring-2 [&_[role=switch]]:focus-visible:ring-ring [&_[role=switch]]:focus-visible:ring-offset-2 [&_[role=switch]]:focus-visible:ring-offset-background [&_input[type=checkbox]]:focus-visible:outline-none [&_input[type=checkbox]]:focus-visible:ring-2 [&_input[type=checkbox]]:focus-visible:ring-ring [&_input[type=checkbox]]:focus-visible:ring-offset-2 [&_input[type=checkbox]]:focus-visible:ring-offset-background [&_input[type=radio]]:focus-visible:outline-none [&_input[type=radio]]:focus-visible:ring-2 [&_input[type=radio]]:focus-visible:ring-ring [&_input[type=radio]]:focus-visible:ring-offset-2 [&_input[type=radio]]:focus-visible:ring-offset-background [&_[role=checkbox][aria-invalid=true]]:focus-visible:ring-2 [&_[role=checkbox][aria-invalid=true]]:focus-visible:ring-destructive [&_[role=checkbox][aria-invalid=true]]:focus-visible:ring-offset-2 [&_[role=checkbox][aria-invalid=true]]:focus-visible:ring-offset-background [&_[role=checkbox][aria-invalid=true]]:focus-visible:border-destructive [&_[role=checkbox][data-error]]:focus-visible:ring-2 [&_[role=checkbox][data-error]]:focus-visible:ring-destructive [&_[role=checkbox][data-error]]:focus-visible:ring-offset-2 [&_[role=checkbox][data-error]]:focus-visible:ring-offset-background [&_[role=checkbox][data-error]]:focus-visible:border-destructive [&_[role=radio][aria-invalid=true]]:focus-visible:ring-2 [&_[role=radio][aria-invalid=true]]:focus-visible:ring-destructive [&_[role=radio][aria-invalid=true]]:focus-visible:ring-offset-2 [&_[role=radio][aria-invalid=true]]:focus-visible:ring-offset-background [&_[role=radio][aria-invalid=true]]:focus-visible:border-destructive [&_[role=radio][data-error]]:focus-visible:ring-2 [&_[role=radio][data-error]]:focus-visible:ring-destructive [&_[role=radio][data-error]]:focus-visible:ring-offset-2 [&_[role=radio][data-error]]:focus-visible:ring-offset-background [&_[role=radiogroup][aria-invalid=true]_[role=radio]]:focus-visible:ring-destructive [&_[role=radiogroup][data-error]_[role=radio]]:focus-visible:ring-destructive [&_[role=switch][aria-invalid=true]]:focus-visible:ring-2 [&_[role=switch][aria-invalid=true]]:focus-visible:ring-destructive [&_[role=switch][aria-invalid=true]]:focus-visible:ring-offset-2 [&_[role=switch][aria-invalid=true]]:focus-visible:ring-offset-background [&_[role=switch][data-error]]:focus-visible:ring-destructive [&_input[type=checkbox][aria-invalid=true]]:focus-visible:ring-2 [&_input[type=checkbox][aria-invalid=true]]:focus-visible:ring-destructive [&_input[type=checkbox][aria-invalid=true]]:focus-visible:ring-offset-2 [&_input[type=checkbox][aria-invalid=true]]:focus-visible:ring-offset-background [&_input[type=radio][aria-invalid=true]]:focus-visible:ring-2 [&_input[type=radio][aria-invalid=true]]:focus-visible:ring-destructive [&_input[type=radio][aria-invalid=true]]:focus-visible:ring-offset-2 [&_input[type=radio][aria-invalid=true]]:focus-visible:ring-offset-background [&_label:has(+_[role=checkbox][aria-invalid=true])]:text-destructive [&_label:has(+_[role=radio][aria-invalid=true])]:text-destructive [&_label:has(+_[role=switch][aria-invalid=true])]:text-destructive [&_label:has(+_input[type=checkbox][aria-invalid=true])]:text-destructive [&_label:has(+_input[type=radio][aria-invalid=true])]:text-destructive">
      {/* ── Aurora background (global) ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="aurora-blob absolute -top-40 -left-40 w-[780px] h-[780px] rounded-full bg-primary/50 blur-[180px]" />
        <div className="aurora-blob aurora-blob-2 absolute top-1/4 -right-48 w-[700px] h-[700px] rounded-full bg-accent/50 blur-[180px]" />
        <div className="aurora-blob aurora-blob-3 absolute bottom-0 left-1/4 w-[640px] h-[640px] rounded-full bg-primary-glow/40 blur-[200px]" />
        <div className="aurora-blob aurora-blob-4 absolute top-1/2 right-1/3 w-[520px] h-[520px] rounded-full bg-[hsl(295_85%_60%/0.35)] blur-[170px]" />
        <div className="aurora-blob absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-[hsl(195_90%_55%/0.3)] blur-[180px]" />
        <div className="absolute inset-0 noise-overlay opacity-40" />
        <div className="absolute inset-0 grid-pattern opacity-[0.18]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,hsl(240_60%_4%/0.85)_95%)]" />
      </div>

      <div className="relative z-10">

      {/* ── Sticky scroll CTA bar ── */}
      <motion.div
        initial={false}
        animate={showStickyCTA ? { y: 0, opacity: 1 } : { y: -80, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed top-[64px] left-0 right-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/40 shadow-lg"
        style={{ pointerEvents: showStickyCTA ? "auto" : "none" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm font-medium truncate">
              <span className="hidden sm:inline">Ready to transform your field operations?</span>
              <span className="sm:hidden">Get started today</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => document.getElementById("demo-video")?.scrollIntoView({ behavior: "smooth" }) ?? window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-border/60 bg-background/40 hover:bg-secondary/60 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Watch Demo
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-primary-foreground gradient-vibrant shadow-glow hover:shadow-glow-accent transition-shadow"
            >
              Start Free Trial
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Spacer reserves layout space under the fixed sticky CTA bar so content doesn't shift.
          Uses a CSS variable so height transitions smoothly without per-frame JS layout writes. */}
      <div
        aria-hidden
        className="transition-[height] duration-300 ease-out will-change-[height]"
        style={{ height: "var(--sticky-cta-h, 0px)", overflow: "hidden" }}
      />


      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform p-1">
              <FieldFlowMark variant="icon" width={36} height={36} className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-bold font-display text-foreground tracking-tight">FieldFlow</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {[
              { href: "#services", label: "Services" },
              { href: "#how", label: "How it works" },
              { href: "#case-studies", label: "Case studies" },
              { href: "#roi", label: "ROI" },
              { href: "#contact", label: "Contact" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
                {l.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Sign in</Link>
            <Link
              to="/login"
              className="relative gradient-primary text-primary-foreground px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-1.5 shadow-glow hover:shadow-[0_0_32px_hsl(var(--primary)/0.4)] hover:-translate-y-px"
            >
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative pt-32 pb-24 sm:pt-40 sm:pb-32 px-4 overflow-hidden">
        {/* Vibrant ambient orbs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <motion.div
            className="absolute -top-20 -left-32 w-[620px] h-[620px] rounded-full bg-primary/40 blur-[140px]"
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.75, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full bg-accent/45 blur-[160px]"
            animate={{ scale: [1, 1.22, 1], opacity: [0.45, 0.7, 0.45] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          <motion.div
            className="absolute bottom-0 left-1/3 w-[480px] h-[480px] rounded-full bg-[hsl(320_92%_60%/0.4)] blur-[150px]"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.65, 0.4] }}
            transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left: copy & CTAs */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="lg:col-span-7 text-center lg:text-left"
            >
              {/* Announcement chip */}
              <motion.a
                href="#how"
                variants={fadeIn}
                className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-primary/15 via-accent/15 to-primary/15 backdrop-blur-md border border-primary/30 mb-7 shadow-[0_0_24px_hsl(var(--primary)/0.25)] hover:border-primary/50 transition-all"
              >
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full gradient-vibrant text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> New
                </span>
                <span className="text-xs font-semibold text-foreground tracking-wide">AI Copilot v3.0 is live</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </motion.a>

              {/* Headline */}
              <motion.h1
                variants={fadeUp}
                className="font-display text-foreground mb-6 tracking-tight"
                style={{ fontSize: "clamp(2.75rem, 7.5vw, 6rem)", lineHeight: 1.1, fontWeight: 800 }}
              >
                Field engineering,{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-[hsl(232_100%_70%)] via-[hsl(282_95%_68%)] to-[hsl(320_95%_68%)] bg-clip-text text-transparent">
                    delivered worldwide.
                  </span>
                  <motion.span
                    aria-hidden
                    className="absolute -bottom-2 left-0 right-0 h-3 gradient-vibrant blur-2xl opacity-50"
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </span>
              </motion.h1>

              {/* Subhead */}
              <motion.p
                variants={fadeUp}
                className="text-lg sm:text-xl text-foreground/80 max-w-2xl mx-auto lg:mx-0 mb-9 leading-relaxed"
              >
                The all-in-one field service platform to dispatch certified engineers, track jobs in
                real time, and automate billing — powered by AI for smarter scheduling, SLA
                compliance, and on-site delivery of network infrastructure hands & feet support for L1, L2, L3 and structured cabling
                across <span className="text-foreground font-semibold">190+ countries</span>. Trusted
                by MSPs, telcos, and enterprises to cut dispatch time, eliminate paperwork, and
                deliver flawless installs at global scale.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                <Link
                  to="/login"
                  className="group relative gradient-vibrant text-primary-foreground px-8 py-4 rounded-2xl text-base font-bold transition-all flex items-center gap-2 justify-center shadow-glow hover:shadow-[0_0_48px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5 overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="relative">Start Free Trial</span>
                  <ArrowRight className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#how"
                  className="group px-8 py-4 rounded-2xl text-base font-bold border-2 border-border bg-card/60 backdrop-blur-md text-foreground hover:bg-card hover:border-primary/50 transition-all flex items-center gap-2.5 justify-center"
                >
                  <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                    <Play className="w-3 h-3 text-primary fill-primary ml-0.5" />
                  </span>
                  Watch 2-min Demo
                </a>
              </motion.div>

              {/* Trust row */}
              <motion.div variants={fadeIn} className="flex flex-wrap items-center gap-x-5 gap-y-3 justify-center lg:justify-start">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {["SM", "JC", "ET", "AK"].map((initials, i) => (
                      <div
                        key={initials}
                        className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary-foreground"
                        style={{
                          background: `linear-gradient(135deg, hsl(${232 + i * 22} 90% 60%), hsl(${282 + i * 18} 88% 62%))`,
                        }}
                      >
                        {initials}
                      </div>
                    ))}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-warning text-warning" />
                      ))}
                      <span className="text-xs font-bold text-foreground ml-1">4.9</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">from 1,200+ ops teams</p>
                  </div>
                </div>
                <span className="hidden sm:block w-px h-8 bg-border" />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {["No credit card", "14-day free trial", "SOC 2 compliant"].map((t) => (
                    <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="w-3.5 h-3.5 text-success" /> {t}
                    </span>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Right: hero visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 relative"
            >
              <div className="absolute -inset-8 gradient-vibrant rounded-[2rem] blur-3xl opacity-50 -z-10" />

              <div className="relative rounded-3xl overflow-hidden border border-border/80 shadow-2xl glow-border">
                <img
                  src={heroEngineerRouter}
                  alt="Field engineer installing network routers in a server rack"
                  width={1920}
                  height={1080}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

                <motion.div
                  className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-elevated"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold text-foreground leading-tight">Engineer on-site</p>
                    <p className="text-[9px] text-muted-foreground leading-tight">London, UK · 14:32</p>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-elevated"
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                >
                  <div className="w-7 h-7 rounded-lg gradient-vibrant flex items-center justify-center">
                    <Network className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-foreground leading-tight">R-2294 · Online</p>
                    <p className="text-[9px] text-success leading-tight font-semibold">SLA 98.2%</p>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute top-1/2 -right-4 -translate-y-1/2 flex items-center gap-2 px-3 py-2 rounded-xl gradient-vibrant border border-white/20 shadow-glow-accent"
                  animate={{ x: [0, -6, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                  <span className="text-[10px] font-bold text-primary-foreground">AI Dispatched · 2.4s</span>
                </motion.div>
              </div>

              {/* Stat pill below image */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -bottom-16 sm:-bottom-20 md:-bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-elevated whitespace-nowrap max-w-[calc(100%-1rem)]"
              >
                <div className="text-center">
                  <p className="text-base font-bold font-display text-gradient-animated">50k+</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Jobs</p>
                </div>
                <span className="w-px h-7 bg-border" />
                <div className="text-center">
                  <p className="text-base font-bold font-display text-gradient-animated">190+</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Countries</p>
                </div>
                <span className="w-px h-7 bg-border" />
                <div className="text-center">
                  <p className="text-base font-bold font-display text-gradient-animated">99.9%</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Uptime</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Marquee logos ── */}
      <section className="py-10 border-y border-border/60 bg-card/20 backdrop-blur-sm overflow-hidden">
        <p className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 mb-5 font-medium">Trusted by operations teams worldwide</p>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
          <div className="flex animate-marquee w-max">
            {[...logos, ...logos].map((name, i) => (
              <span key={i} className="text-xl font-bold font-display text-foreground/40 hover:text-foreground/80 transition-colors whitespace-nowrap mx-10">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section id="stats" className="py-20 sm:py-24 px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {stats.map((s) => (
            <motion.div
              key={s.label}
              variants={scaleIn}
              onMouseMove={spotlight}
              className="spotlight-card text-center p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/30 transition-all hover:-translate-y-1"
            >
              <div className="w-9 h-9 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-1">
                <AnimatedCounter target={s.value} />{s.suffix && <span className="text-muted-foreground text-xl">{s.suffix}</span>}
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-24 sm:py-28 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">How it works</p>
            <h2 className="font-display text-foreground mb-4 tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Four steps to <span className="text-gradient-animated">operational excellence</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">From service request to payment — fully automated, fully tracked.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {workflow.map((w, i) => (
              <motion.div
                key={w.step}
                variants={fadeUp}
                onMouseMove={spotlight}
                className="spotlight-card relative group p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all hover:-translate-y-1"
              >
                {i < workflow.length - 1 && (
                  <div className="hidden lg:block absolute top-12 -right-2 w-4 h-px bg-gradient-to-r from-border to-transparent" />
                )}
                <span className="text-4xl font-bold font-display text-gradient-animated block mb-3 opacity-80">{w.step}</span>
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <w.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-base font-semibold font-display text-foreground mb-1.5">{w.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{w.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="py-24 sm:py-28 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Platform capabilities</p>
            <h2 className="font-display text-foreground mb-4 tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Built for <span className="text-gradient-animated">enterprise field operations</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">Every tool your operations team needs — purpose-built, not bolted on.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={scaleIn}
                onMouseMove={spotlight}
                className="spotlight-card group p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all hover:-translate-y-1"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.accent === "accent" ? "bg-accent/10 border border-accent/20" : "bg-primary/10 border border-primary/20"}`}>
                  <f.icon className={`w-5 h-5 ${f.accent === "accent" ? "text-accent" : "text-primary"}`} />
                </div>
                <h3 className="text-base font-semibold font-display text-foreground mb-2 flex items-center gap-1.5">
                  {f.title}
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Additional capabilities */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mt-12 p-7 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-5 text-center">Also included</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {capabilities.map((cap) => (
                <div key={cap} className="flex items-center gap-2 text-xs text-foreground">
                  <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 sm:py-28 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Testimonials</p>
            <h2 className="font-display text-foreground tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Trusted by <span className="text-gradient-animated">operations leaders</span>
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                onMouseMove={spotlight}
                className="spotlight-card p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/30 transition-all"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-warning fill-warning" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-glow">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.role} · {t.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-24 sm:py-28 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Services we deliver</p>
            <h2 className="font-display text-foreground mb-4 tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              The unified <span className="text-gradient-animated">global ICT delivery</span> stack
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">From field engineers to L1/L2/L3 network infrastructure hands & feet, circuits, warehousing and managed services — under one roof.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((s) => (
              <motion.div key={s.title} variants={scaleIn} onMouseMove={spotlight}
                className="spotlight-card p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all hover:-translate-y-1">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold font-display text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Hands & Feet proof points ── */}
      <section id="handsfeet-proof" className="py-24 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Hands & Feet delivery results</p>
            <h2 className="font-display text-foreground mb-4 tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Measurable outcomes for <span className="text-gradient-animated">L1, L2 & L3 on-site work</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Benchmarks across 50,000+ dispatched hands & feet jobs in network infrastructure, smart hands and IMAC/D engagements.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(proofPoints.length > 0 ? proofPoints : FALLBACK_PROOF_POINTS).map((s) => {
              const Icon = getProofPointIcon(s.icon);
              return (
                <motion.div key={s.label} variants={scaleIn} onMouseMove={spotlight}
                  className="spotlight-card p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all hover:-translate-y-1">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-3xl font-display font-bold text-foreground tracking-tight mb-1">{s.value}</div>
                  <div className="text-sm font-semibold text-foreground mb-1">{s.label}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.sub}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* ── Methodology & sources ── */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={fadeUp}
            className="mt-12 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">How we measure & report these numbers</h3>
                <p className="text-xs text-muted-foreground">
                  Every proof point above is computed from operational data captured by the FieldFlow platform — no marketing estimates.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              {[
                {
                  metric: "Avg dispatch time (−68%)",
                  formula: "Δt = ticket created → engineer accepts & en-route",
                  source: "Dispatch ticket events vs. baseline from client onboarding survey (legacy MSP averages).",
                },
                {
                  metric: "First-time fix rate (98.4%)",
                  formula: "Jobs closed on first visit ÷ total L1/L2 jobs",
                  source: "Engineer mobile app close-out + post-visit client confirmation. Repeat truck rolls within 7 days are excluded from the numerator.",
                },
                {
                  metric: "SLA compliance (99.2%)",
                  formula: "SLA-met jobs ÷ all jobs with a contracted SLA",
                  source: "SLA timer engine — measures arrival, acknowledgement and resolution against per-contract targets (4-hour, NBD, same-day).",
                },
                {
                  metric: "Countries covered (190+)",
                  formula: "Distinct ISO-3166 countries with ≥1 vetted L1/L2/L3 engineer in the talent pool",
                  source: "Talent-pool registry; only background-checked, certified engineers count. Updated weekly.",
                },
                {
                  metric: "Mean time to on-site (< 2 hrs)",
                  formula: "Median(P1/P2 ticket created → engineer on-site GPS check-in)",
                  source: "Top-25 metro areas only; GPS check-in via the engineer mobile app within the site geofence.",
                },
                {
                  metric: "Client satisfaction (4.92 / 5)",
                  formula: "Mean of post-job CSAT scores (1–5) over rolling 90 days",
                  source: "CSAT survey sent automatically after every closed hands & feet visit. ~62% response rate.",
                },
                {
                  metric: "Photo-evidenced handover (100%)",
                  formula: "Closed jobs with ≥1 site photo + signed handover ÷ total closed jobs",
                  source: "Mobile app enforces photo capture & client signature before close-out — required field, not optional.",
                },
                {
                  metric: "Certified field engineers (12,000+)",
                  formula: "Active engineers with ≥1 valid vendor cert (CCNA / CCNP / JNCIA / Fortinet NSE / equivalent)",
                  source: "Certification documents verified at onboarding and re-validated on expiry; expired certs are removed from the count.",
                },
              ].map((m) => (
                <div key={m.metric} className="border-l-2 border-primary/30 pl-4">
                  <p className="text-sm font-semibold text-foreground mb-1">{m.metric}</p>
                  <p className="text-xs text-muted-foreground mb-1">
                    <span className="font-mono text-foreground/80">Formula:</span> {m.formula}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Source:</span> {m.source}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground mb-1">Reporting window</p>
                Rolling 12 months across 50,000+ closed hands & feet tickets. Refreshed weekly.
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Data integrity</p>
                Cancelled, duplicate and out-of-scope tickets are excluded. Outliers above the 99th percentile are capped, not removed.
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Independent review</p>
                SLA and CSAT methodology reviewed annually by a Big-4 assurance partner. Full report available under NDA.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── High-visibility CTA banner ── */}
      <section aria-labelledby="dispatch-cta-heading" className="px-4 -mt-6 sm:-mt-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            onMouseMove={spotlight}
            className="spotlight-card relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/[0.18] via-primary/[0.08] to-accent/[0.12] backdrop-blur-md p-6 sm:p-10 shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.35)]"
          >
            {/* decorative glow */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/30 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent/20 blur-3xl" aria-hidden />

            <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[11px] uppercase tracking-[0.18em] text-primary font-semibold mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Engineers available now in 190+ countries
                </div>
                <h2
                  id="dispatch-cta-heading"
                  className="font-display text-foreground tracking-tight mb-3"
                  style={{ fontSize: "clamp(1.75rem, 3.6vw, 2.75rem)", lineHeight: 1.1, letterSpacing: "-0.02em", fontWeight: 700 }}
                >
                  Need a hands & feet engineer on-site? <span className="text-gradient-animated">Get availability + a quote in under 1 hour.</span>
                </h2>
                <p className="text-base text-muted-foreground max-w-xl mb-6">
                  Tell us the site, the SLA and the work. We'll confirm L1, L2 or L3 engineer availability and send a fixed-price quote — no procurement back-and-forth.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6 text-sm">
                  {[
                    { icon: Clock, label: "Response < 1 hr" },
                    { icon: Shield, label: "Fixed-price quote" },
                    { icon: CheckCircle, label: "No retainer required" },
                  ].map((p) => (
                    <li key={p.label} className="flex items-center gap-2 text-foreground/90">
                      <p.icon className="w-4 h-4 text-primary shrink-0" />
                      {p.label}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#dispatch-quote"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
                  >
                    Request dispatch & quote <ArrowRight className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={handleEstimateSavings}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md border border-border/80 bg-card/60 text-foreground font-medium hover:bg-card/80 hover:border-primary/40 transition-colors"
                  >
                    <Calculator className="w-4 h-4" /> Estimate my savings
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-4">
                  Average first reply: <span className="text-foreground font-semibold">17 minutes</span> during business hours · 24/7 P1 dispatch hotline available.
                </p>
              </div>

              {/* Stat tiles */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Timer, value: "< 1 hr", label: "Avg quote turnaround" },
                  { icon: MapPin, value: "190+", label: "Countries on-call" },
                  { icon: HandMetal, value: "12,000+", label: "Vetted L1/L2/L3" },
                  { icon: Shield, value: "99.2%", label: "SLA hit rate" },
                ].map((t) => (
                  <div
                    key={t.label}
                    className="p-4 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md hover:border-primary/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
                      <t.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-xl font-display font-bold text-foreground tabular-nums">{t.value}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">{t.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ROI Calculator ── */}
      <section id="roi" className="py-24 px-4 relative scroll-mt-32 sm:scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">ROI Calculator</p>
            <h2
              ref={roiHeadingRef}
              tabIndex={-1}
              className="font-display text-foreground mb-4 tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}
            >
              Estimate your <span className="text-gradient-animated">L1, L2 & L3 hands & feet savings</span>
            </h2>
            {roiPrefilled && (
              <div
                ref={roiPrefillChipRef}
                className="mx-auto max-w-xl mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs text-foreground"
              >
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
                Prefilled from your dispatch request · weighted to {roiPrefilled.level} ·{" "}
                {roiPrefilled.sla.replace(/_/g, " ")}
              </div>
            )}
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Plug in your monthly ticket volume and current vendor rates. We'll model cost savings and faster dispatch using FieldFlow's marketplace benchmarks.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={fadeUp}
              onMouseMove={spotlight}
              className="spotlight-card p-6 sm:p-8 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Your monthly hands & feet workload</h3>
              </div>

              {[
                { label: "L1 — Smart hands tickets / month", val: roiL1, set: setRoiL1, max: 500, rate: roiLegacyL1, setRate: setRoiLegacyL1, rateMax: 400, hint: "Rack & stack, cabling, reboots, swaps" },
                { label: "L2 — Field technician tickets / month", val: roiL2, set: setRoiL2, max: 300, rate: roiLegacyL2, setRate: setRoiLegacyL2, rateMax: 600, hint: "Installs, IMAC/D, basic config, RMA" },
                { label: "L3 — Senior engineer tickets / month", val: roiL3, set: setRoiL3, max: 200, rate: roiLegacyL3, setRate: setRoiLegacyL3, rateMax: 900, hint: "Routing, SD-WAN, firewall, RCA" },
              ].map((row) => (
                <div key={row.label} className="mb-6 last:mb-0">
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <label className="text-sm font-medium text-foreground">{row.label}</label>
                    <span className="text-sm font-semibold text-primary tabular-nums">{row.val}</span>
                  </div>
                  <input
                    type="range" min={0} max={row.max} value={row.val}
                    onChange={(e) => row.set(Number(e.target.value))}
                    aria-label={row.label}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center justify-between mt-3 gap-3">
                    <label className="text-xs text-muted-foreground">{row.hint} — current vendor rate / hr (USD)</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number" min={0} max={row.rateMax} value={row.rate}
                        onChange={(e) => row.setRate(Math.max(0, Math.min(row.rateMax, Number(e.target.value) || 0)))}
                        aria-label={`Current vendor rate for ${row.label}`}
                        className="w-20 h-8 px-2 rounded-md border border-input bg-background text-sm text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <p className="text-[11px] text-muted-foreground mt-2">
                Assumes ~1 hr per L1, ~1 hr per L2 and ~1 hr per L3 on-site billable hour. Adjust rates to match your contracts.
              </p>
            </motion.div>

            {/* Results */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={fadeUp}
              onMouseMove={spotlight}
              className="spotlight-card p-6 sm:p-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.06] via-card/60 to-card/60 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Your projected outcome with FieldFlow</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl border border-border/60 bg-card/60">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <DollarSign className="w-3.5 h-3.5" /> Monthly savings
                  </div>
                  <div className="text-2xl font-display font-bold text-foreground tabular-nums">{fmtUSD(monthlySavings)}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">vs {fmtUSD(legacyMonthly)} legacy spend</div>
                </div>
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/[0.06]">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" /> Annual savings
                  </div>
                  <div className="text-2xl font-display font-bold text-primary tabular-nums">{fmtUSD(annualSavings)}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{savingsPct}% lower run-rate cost</div>
                </div>
                <div className="p-4 rounded-xl border border-border/60 bg-card/60">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Timer className="w-3.5 h-3.5" /> Dispatch time saved
                  </div>
                  <div className="text-2xl font-display font-bold text-foreground tabular-nums">{dispatchHoursSavedMonth.toLocaleString()} hrs</div>
                  <div className="text-[11px] text-muted-foreground mt-1">~{dispatchSavedHours} hrs faster per ticket × {monthlyJobs} jobs</div>
                </div>
                <div className="p-4 rounded-xl border border-border/60 bg-card/60">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Clock className="w-3.5 h-3.5" /> Mean time to on-site
                  </div>
                  <div className="text-2xl font-display font-bold text-foreground">&lt; 2 hrs</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Major metros, P1/P2 incidents</div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card/40 p-4 mb-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Cost breakdown / month</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">L1 ({roiL1} jobs × ${ffL1})</span>
                    <span className="text-foreground tabular-nums font-medium">{fmtUSD(roiL1 * ffL1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">L2 ({roiL2} jobs × ${ffL2})</span>
                    <span className="text-foreground tabular-nums font-medium">{fmtUSD(roiL2 * ffL2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">L3 ({roiL3} jobs × ${ffL3})</span>
                    <span className="text-foreground tabular-nums font-medium">{fmtUSD(roiL3 * ffL3)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <span className="text-foreground font-semibold">FieldFlow total</span>
                    <span className="text-primary tabular-nums font-bold">{fmtUSD(ffMonthly)}</span>
                  </div>
                </div>
              </div>

              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Get a tailored quote <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Estimates based on FieldFlow marketplace benchmarks across 50,000+ hands & feet jobs. Final pricing depends on geography, SLA and volume.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Comparison vs traditional providers ── */}
      <section id="compare" className="py-24 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">How we compare</p>
            <h2 className="font-display text-foreground mb-4 tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Modern platform vs. <span className="text-gradient-animated">legacy global ICT providers</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">Same global field-engineering reach as traditional providers — delivered through a real-time platform, not email and spreadsheets.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur-md">
            <div className="grid grid-cols-3 text-sm">
              <div className="p-5 border-b border-border/60 bg-background/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Capability</p>
              </div>
              <div className="p-5 border-b border-l border-border/60 bg-primary/5">
                <p className="text-xs uppercase tracking-wider text-primary font-bold">FieldFlow</p>
              </div>
              <div className="p-5 border-b border-l border-border/60 bg-background/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Legacy global ICT vendor</p>
              </div>

              {[
                { cap: "Global field engineers (190+ countries)", us: true, them: true },
                { cap: "L1/L2/L3 network infrastructure hands & feet", us: true, them: true },
                { cap: "IMAC/D, Smart Hands, Staging & FSL", us: true, them: true },
                { cap: "Real-time AI dispatch & engineer matching", us: true, them: false },
                { cap: "Live GPS tracking & geofence ETAs", us: true, them: false },
                { cap: "Self-serve client portal & ticket creation", us: true, them: false },
                { cap: "Automated SLA breach detection", us: true, them: false },
                { cap: "Digital signatures, photo-proof & voice notes", us: true, them: false },
                { cap: "In-platform invoicing & wallet payments", us: true, them: false },
                { cap: "Transparent rate cards by region & skill", us: true, them: false },
                { cap: "Onboarding measured in days, not months", us: true, them: false },
              ].map((row, i) => (
                <div key={row.cap} className="contents">
                  <div className={`p-4 ${i % 2 ? "bg-background/10" : ""} text-foreground`}>{row.cap}</div>
                  <div className={`p-4 border-l border-border/60 ${i % 2 ? "bg-primary/10" : "bg-primary/5"}`}>
                    {row.us ? <CheckCircle className="w-4 h-4 text-success" /> : <X className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className={`p-4 border-l border-border/60 ${i % 2 ? "bg-background/10" : ""}`}>
                    {row.them ? <CheckCircle className="w-4 h-4 text-success/70" /> : <X className="w-4 h-4 text-destructive/70" />}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Industries ── */}
      <section id="industries" className="py-20 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Industries we serve</p>
            <h2 className="font-display text-foreground tracking-tight" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Built for <span className="text-gradient-animated">multi-site operators</span>
            </h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {industries.map((i) => (
              <motion.div key={i.label} variants={fadeUp} onMouseMove={spotlight}
                className="spotlight-card p-5 rounded-xl border border-border/60 bg-card/40 backdrop-blur-md text-center hover:border-primary/40 transition-all hover:-translate-y-0.5">
                <i.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-xs font-medium text-foreground">{i.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Case studies ── */}
      <section id="case-studies" className="py-24 sm:py-28 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Proof at scale</p>
            <h2 className="font-display text-foreground mb-4 tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Delivered for <span className="text-gradient-animated">tier-1 enterprises</span>
            </h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {caseStudies.map((c) => (
              <motion.article key={c.title} variants={fadeUp} onMouseMove={spotlight}
                className="spotlight-card p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all hover:-translate-y-1 flex flex-col">
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent font-semibold mb-3">{c.vertical}</p>
                <h3 className="text-base font-semibold font-display text-foreground mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{c.body}</p>
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                  <span className="text-xs font-bold font-display text-gradient-animated">{c.metric}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Hands & Feet case studies (before/after) ── */}
      <section id="handsfeet-cases" className="py-24 sm:py-28 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Hands & Feet case studies</p>
            <h2 className="font-display text-foreground mb-4 tracking-tight" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Before & after on real <span className="text-gradient-animated">L1, L2 & L3 engagements</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Network infrastructure support outcomes from clients who switched from legacy global ICT vendors to FieldFlow's marketplace.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                tier: "L1 — Smart Hands",
                vertical: "Global Retail Bank",
                icon: Hand,
                challenge: "Branch network refresh across 1,200 sites — switch swaps, patching and structured cabling tasks slowed by ticket bouncing between MSPs.",
                solution: "Single dispatch queue with vetted L1 smart hands engineers, runbook-driven jobs, photo-evidenced handover and live ETAs.",
                outcomes: [
                  { label: "On-site arrival time", before: "8.4 hrs", after: "1.7 hrs" },
                  { label: "First-time fix rate", before: "71%", after: "98.6%" },
                  { label: "Cost per smart-hands ticket", before: "$245", after: "$112" },
                ],
                headline: "−54% cost · 5x faster",
              },
              {
                tier: "L2 — Field Technician",
                vertical: "SaaS Data-Center Operator",
                icon: HandMetal,
                challenge: "IMAC/D and rack-and-stack across 28 colocation facilities — vendor escalations and inconsistent quality created repeat truck rolls.",
                solution: "Certified L2 field engineers with cable certification, firmware upgrades and structured handover. NOC oversight on every job.",
                outcomes: [
                  { label: "Repeat truck rolls", before: "1 in 4 jobs", after: "1 in 38 jobs" },
                  { label: "Avg IMAC/D cycle time", before: "5 days", after: "36 hrs" },
                  { label: "SLA breach rate", before: "12%", after: "0.6%" },
                ],
                headline: "10x fewer repeat visits",
              },
              {
                tier: "L3 — Senior Engineer",
                vertical: "Multinational Manufacturer",
                icon: Grab,
                challenge: "Complex BGP/OSPF cutovers and firewall policy work across 14 plants — relied on fly-in vendor teams with 2-week lead times.",
                solution: "On-demand senior network engineers (CCIE / JNCIE) on-site within 24 hrs alongside the in-house NOC for live cutover support.",
                outcomes: [
                  { label: "Lead time to senior engineer", before: "11 days", after: "18 hrs" },
                  { label: "Cutover incidents (P1)", before: "6 / quarter", after: "0 / quarter" },
                  { label: "Engineering cost per site", before: "$11,200", after: "$4,850" },
                ],
                headline: "−57% engineering spend",
              },
            ].map((c) => (
              <motion.article key={c.tier + c.vertical} variants={scaleIn} onMouseMove={spotlight}
                className="spotlight-card p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all hover:-translate-y-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <c.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-semibold">{c.tier}</p>
                    <p className="text-xs text-muted-foreground">{c.vertical}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Challenge</p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{c.challenge}</p>
                </div>
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Solution</p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{c.solution}</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-card/40 p-3 mb-4 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Before → After</p>
                  <div className="space-y-2.5">
                    {c.outcomes.map((o) => (
                      <div key={o.label}>
                        <div className="text-[11px] text-muted-foreground mb-1">{o.label}</div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="px-2 py-0.5 rounded-md bg-destructive/10 text-destructive line-through tabular-nums text-xs font-medium">{o.before}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary tabular-nums text-xs font-semibold">{o.after}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-sm font-bold font-display text-gradient-animated">{c.headline}</span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>
      {/* ── Dispatch availability + quote request ── */}
      <section id="dispatch-quote" className="py-24 px-4 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Dispatch availability + quote</p>
            <h2 className="font-display text-foreground tracking-tight" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Check engineer availability &amp; <span className="text-gradient-animated">get a fixed-price quote</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
              Share the site, SLA, service level and preferred window. We'll confirm vetted L1/L2/L3 availability and a fixed quote — typically in under one hour during business hours.
            </p>
          </motion.div>

          <DispatchQuoteForm />

        </div>
      </section>

      <section id="contact" className="py-24 px-4 relative">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Request a quote</p>
            <h2 className="font-display text-foreground tracking-tight" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
              Tell us what you want to <span className="text-gradient-animated">achieve</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-3">Leave the rest to our coordinators. We'll come back within one business day.</p>
          </motion.div>
          <motion.form
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            onSubmit={(e) => { e.preventDefault(); alert("Thanks — your request has been received. Our team will contact you shortly."); }}
            className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-foreground mb-1.5 block">Full name *</label>
              <input required className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Company *</label>
              <input required className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition" placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Work email *</label>
              <input type="email" required className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition" placeholder="jane@acme.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Country *</label>
              <input required className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition" placeholder="United Kingdom" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-foreground mb-1.5 block">Service of interest</label>
              <select className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground focus:border-primary/60 focus:outline-none transition">
                {services.map((s) => <option key={s.title}>{s.title}</option>)}
                <option>Multiple / not sure</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-foreground mb-1.5 block">How can we help? *</label>
              <textarea required rows={4} className="w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition" placeholder="Briefly describe your project — sites, countries, timing, devices…" />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input id="consent" type="checkbox" required className="w-4 h-4 rounded border-border" />
              <label htmlFor="consent" className="text-xs text-muted-foreground">I agree to be contacted regarding this enquiry.</label>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="w-full gradient-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 justify-center shadow-glow hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)] hover:-translate-y-0.5">
                Send request <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.form>
        </div>
      </section>

      {/* ── Security strip ── */}
      <section className="py-12 px-4 border-y border-border/60 bg-card/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            { icon: Lock, label: "256-bit Encryption" },
            { icon: Shield, label: "SOC 2 Type II" },
            { icon: Globe, label: "GDPR Compliant" },
            { icon: Headphones, label: "24/7 Support" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <item.icon className="w-4 h-4" />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={scaleIn} className="py-24 sm:py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-3xl p-12 sm:p-16 overflow-hidden border border-border/60 bg-card/40 backdrop-blur-xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--accent)/0.2),transparent_60%)]" />
            <div className="absolute inset-0 dot-pattern opacity-20" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">Limited time · 30% off annual plans</span>
              </div>
              <h2 className="font-display text-foreground mb-5 tracking-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 700 }}>
                Ready to modernise<br />
                <span className="text-gradient-animated">your operations?</span>
              </h2>
              <p className="text-base text-muted-foreground max-w-md mx-auto mb-9">
                Join thousands of field service teams delivering faster with FieldFlow.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/login"
                  className="group inline-flex items-center gap-2 gradient-primary text-primary-foreground px-8 py-3.5 rounded-xl text-sm font-semibold transition-all justify-center shadow-glow hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)] hover:-translate-y-0.5"
                >
                  Start Free Trial <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 border border-border bg-card/60 backdrop-blur-md text-foreground px-8 py-3.5 rounded-xl text-sm font-semibold hover:bg-card hover:border-primary/30 transition-all justify-center"
                >
                  Book a Demo <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-12 px-4 bg-card/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shadow-glow p-0.5">
                  <FieldFlowMark variant="icon" width={32} height={32} className="w-full h-full object-contain" />
                </div>
                <span className="font-bold font-display text-foreground text-sm">FieldFlow</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Enterprise field service management for modern operations teams.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Product</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#how" className="hover:text-foreground transition-colors">How it works</a></li>
                <li><a href="#stats" className="hover:text-foreground transition-colors">Metrics</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Company</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Legal</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="divider-gradient mb-6" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">© 2026 FieldFlow. All rights reserved.</p>
            <div className="flex gap-4 text-muted-foreground">
              <span className="text-[11px] hover:text-foreground transition-colors cursor-pointer">Twitter</span>
              <span className="text-[11px] hover:text-foreground transition-colors cursor-pointer">LinkedIn</span>
              <span className="text-[11px] hover:text-foreground transition-colors cursor-pointer">GitHub</span>
            </div>
          </div>
        </div>
      </footer>

      <LandingChatWidget />
      </div>
    </div>
  );
};

export default Landing;
