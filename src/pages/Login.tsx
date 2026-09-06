import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, ArrowLeft, User, Wrench, Upload, ShieldCheck } from "lucide-react";
import FieldFlowMark from "@/components/branding/FieldFlowMark";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SELF_SIGNUP_ROLES, pickPrimaryRole, homeRouteForRole, type AppRole } from "@/lib/roles";

// Self-service signup roles only. Privileged roles (admin, team_lead, etc.) are
// granted by an administrator and enforced server-side by the handle_new_user trigger.
const ROLE_META: Record<string, { label: string; desc: string }> = {
  client: { label: "Client", desc: "Request services" },
  engineer: { label: "Engineer", desc: "Field operations" },
  partner: { label: "Partner", desc: "Client referrals" },
  recruiter: { label: "Recruiter", desc: "Nominate candidates" }
};
const roles = SELF_SIGNUP_ROLES.map((value) => ({ value, ...ROLE_META[value] }));

const CERTIFICATION_OPTIONS = [
  "None",
  "Cisco Certified Network Associate (CCNA)",
  "Microsoft Certified: Azure Fundamentals",
  "AWS Certified Solutions Architect",
  "CompTIA A+",
  "CompTIA Network+",
  "CompTIA Security+",
  "Google Cloud Associate Engineer",
  "Certified Information Systems Security Professional (CISSP)",
  "Certified Kubernetes Administrator (CKA)",
  "Certified Ethical Hacker (CEH)",
  "ITIL Foundation",
  "PMP",
  "Scrum Master",
] as const;
const ID_TYPE_OPTIONS = ["Aadhaar Card", "PAN Card", "Passport", "Driving License", "National ID", "Work Permit"] as const;

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const Login = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Engineer-only profile fields (shown when selectedRole === "engineer") ──
  const [phone, setPhone] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [certificationChoices, setCertificationChoices] = useState<string[]>([]);
  const [certification, setCertification] = useState("None");
  const [ndaSigned, setNdaSigned] = useState(false);
  const [idType, setIdType] = useState("");
  const [frontIdFile, setFrontIdFile] = useState<File | null>(null);
  const [backIdFile, setBackIdFile] = useState<File | null>(null);

  // ── Approval confirmation popup (shown after "Create Account" for engineers) ──
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showCertificationDropdown, setShowCertificationDropdown] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const isEngineerSignUp = isSignUp && selectedRole === "engineer";

  // Postcode → City/State auto-fill
  useEffect(() => {
    if (!isEngineerSignUp) return;
    const pc = postcode.trim();
    const cc = country.trim();
    if (!pc || pc.length < 3) return;

    const countryCode = cc.length === 2 ? cc.toLowerCase() : "";
    const targetUrl = countryCode
      ? `https://api.zippopotam.us/${countryCode}/${pc}`
      : `https://api.zippopotam.us/us/${pc}`;
    const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(proxiedUrl, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const place = data.places?.[0];
        if (!place) return;
        setCity((prev) => (prev.trim() ? prev : place["place name"] ?? ""));
        setState((prev) => (prev.trim() ? prev : place["state"] ?? place["state abbreviation"] ?? ""));
      } catch {
        // silent
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [postcode, country, isEngineerSignUp]);

  const addSkillFromInput = () => {
    const val = skillsInput.trim();
    if (val && !skills.includes(val)) setSkills((prev) => [...prev, val]);
    setSkillsInput("");
  };
  const removeSkill = (skill: string) => setSkills((prev) => prev.filter((s) => s !== skill));
  const toggleCertificationChoice = (option: string) => {
    if (option === "None") {
      setCertificationChoices([]);
      setCertification("None");
      return;
    }

    setCertificationChoices((prev) => {
      const exists = prev.includes(option);
      const next = exists ? prev.filter((item) => item !== option) : [...prev, option];
      setCertification(next.length ? next.join(" | ") : "None");
      return next;
    });
  };

  const handleIdFileChange = (e: ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Please upload an ID image smaller than 5MB." });
      e.target.value = "";
      return;
    }
    if (side === "front") setFrontIdFile(file);
    else setBackIdFile(file);
  };

  const resetEngineerFields = () => {
    setPhone(""); setResidentialAddress(""); setSpecialty("");
    setCity(""); setState(""); setPostcode(""); setCountry("");
    setSkillsInput(""); setSkills([]);
    setCertificationChoices([]); setCertification("None"); setNdaSigned(false); setIdType("");
    setShowCertificationDropdown(false);
    setFrontIdFile(null); setBackIdFile(null);
  };

  // Reset only the engineer-specific extras when leaving that role — full
  // name / email / password are shared fields and must survive the switch.
  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
    if (role !== "engineer") resetEngineerFields();
  };

  const validateEngineerFields = () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error("Name, email and password are required");
      return false;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }
    if (!phone.trim() || !postcode.trim() || !idType.trim()) {
      toast.error("Missing required fields", { description: "Please fill Phone, Zip Code, and ID Type." });
      return false;
    }
    if (!frontIdFile || !backIdFile) {
      toast.error("ID documents required", { description: "Please upload both front and back ID images." });
      return false;
    }
    if (!ndaSigned) {
      toast.error("NDA confirmation required", { description: "Please sign the NDA before submitting your engineer application." });
      return false;
    }
    return true;
  };

  // Step 1 for engineer sign-up: validate the form, then open the approval confirmation modal
  const openAdminPicker = () => {
    if (!validateEngineerFields()) return;
    setShowAdminModal(true);
  };

  // Step 2: creates the account + pending approval record. No specific admin is
  // chosen by the applicant — the application goes into the shared review queue
  // and any admin can pick it up.
  const confirmEngineerSubmit = async () => {
    setSubmittingApproval(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const frontData = frontIdFile ? await fileToDataUrl(frontIdFile) : null;
      const backData = backIdFile ? await fileToDataUrl(backIdFile) : null;

      // Single server-side call: creates the account (pre-confirmed) and
      // submits the application in one step. Engineers rely solely on admin
      // approval as their gate — never on an email confirmation link.
      const { data, error } = await supabase.functions.invoke("engineer-signup", {
        body: {
          email: cleanEmail,
          password,
          full_name: fullName.trim(),
          phone: phone.trim(),
          residential_address: residentialAddress.trim() || null,
          specialty: specialty.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          postcode: postcode.trim() || null,
          country: country.trim() || null,
          skills,
          certification: certificationChoices.length ? certificationChoices.join(" | ") : null,
          certifications: certificationChoices,
          nda_signed: ndaSigned,
          id_type: idType,
          id_document_front_name: frontIdFile?.name ?? null,
          id_document_front_data: frontData,
          id_document_back_name: backIdFile?.name ?? null,
          id_document_back_data: backData,
        },
      });

      if (error) {
        // supabase-js wraps non-2xx responses in error.context; try to pull
        // the actual message the function returned.
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message || "Signup failed");
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(
        "Account created! An admin will review your application — you'll be able to sign in once it's approved."
      );

      setShowAdminModal(false);
      setIsSignUp(false);
      setPassword("");
      resetEngineerFields();
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEngineerSignUp) {
      openAdminPicker();
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required");
      return;
    }
    if (isSignUp && !fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (isSignUp) {
        // The role is REQUESTED here but ASSIGNED server-side by the
        // handle_new_user trigger (clamped to a safe allow-list). The client
        // must never write to user_roles — that is a privilege-escalation hole.
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: fullName.trim(), requested_role: selectedRole },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;

        // With email confirmation enabled, signUp returns no session: the user
        // is NOT signed in yet and must confirm their email first.
        if (!data.session) {
          toast.success("Account created! Check your email to confirm your address, then sign in.");
          setIsSignUp(false);
          setPassword("");
          return;
        }

        // Session came back immediately (email confirmation disabled). Don't
        // trust the locally-requested role for routing — the trigger may have
        // clamped or rejected it. Look up what was actually assigned.
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id);
        const assignedRole = pickPrimaryRole((roleRows ?? []).map((r) => r.role as AppRole));

        toast.success("Account created! You're now signed in.");
        navigate(homeRouteForRole(assignedRole));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;

        const { data: { user } } = await supabase.auth.getUser();
        let role: AppRole | null = null;

        if (user) {
          const { data: roleRows } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          role = pickPrimaryRole((roleRows ?? []).map((r) => r.role as AppRole));

          if (role === "engineer") {
            // NOTE: column is application_status (with underscore) — matches
            // the engineers table schema. A typo'd column name here used to
            // make this query fail silently and let unapproved engineers in.
            const { data: engineerRow, error: engineerError } = await supabase
              .from("engineers")
              .select("application_status")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (engineerError) {
              console.error("Failed to check engineer application status:", engineerError);
            }

            if (engineerRow && engineerRow.application_status !== "approved") {
              // Not approved yet — block access, drop the session, and route
              // to a holding page instead of letting them into the dashboard.
              await supabase.auth.signOut();
              toast.error(friendlyAuthError("pending approval"));
              navigate("/pending-approval");
              return;
            }
          }
        }

        toast.success("Welcome back!");
        navigate(homeRouteForRole(role));
      }
    } catch (err: unknown) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Map raw Supabase/GoTrue errors to clear, actionable guidance.
  const friendlyAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    const m = msg.toLowerCase();
    if (m.includes("invalid login credentials")) {
      return "Incorrect email or password. If you just signed up, confirm your email first (check your inbox and spam).";
    }
    if (m.includes("email not confirmed")) {
      return "Please confirm your email before signing in — check your inbox for the confirmation link.";
    }
    if (m.includes("already registered") || m.includes("already been registered")) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (m.includes("rate limit") || m.includes("too many")) {
      return "Too many attempts. Please wait a minute and try again.";
    }
    if (m.includes("pending approval")) {
      return "Your account is pending approval. Please wait for an admin to review your application.";
    }
    return msg || "Authentication failed. Please try again.";
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] gradient-hero items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-15" />
        <div className="absolute top-20 left-10 w-80 h-80 bg-primary/8 rounded-full blur-[100px] animate-pulse-soft" />
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-accent/8 rounded-full blur-[80px] animate-pulse-soft stagger-3" />

        <div className="max-w-md relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-glow p-1.5">
              <FieldFlowMark variant="icon" width={48} height={48} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold font-display text-white tracking-tight">FieldFlow</h1>
          </div>
          <h2 className="text-3xl font-bold font-display text-white leading-tight mb-5">
            Dispatch smarter.{" "}
            <span className="text-gradient-accent">Deliver faster.</span>
          </h2>
          <p className="text-white/60 leading-relaxed text-base">
            Connect engineers with clients, manage operations, track performance, and maximize revenue through intelligent dispatch and automated workflows.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: "Active Engineers", value: "340+" },
              { label: "Jobs This Month", value: "12.4k" },
              { label: "Avg Response", value: "2.4 min" },
              { label: "Client Rating", value: "4.9★" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-3">
                <p className="text-xl font-bold font-display text-white">{stat.value}</p>
                <p className="text-xs text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shadow-glow p-1">
              <FieldFlowMark variant="icon" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">FieldFlow</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold font-display text-foreground tracking-tight">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-muted-foreground mt-1.5">
              {isSignUp ? "Get started with FieldFlow" : "Sign in to continue to your dashboard"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="animate-fade-in">
                <label className="block text-sm font-medium text-foreground mb-2">Select your role</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {roles.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => handleRoleSelect(role.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                        selectedRole === role.value
                          ? "gradient-primary text-primary-foreground shadow-glow"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                      }`}
                    >
                      <span className="block font-semibold">{role.label}</span>
                      <span className={`block mt-0.5 ${selectedRole === role.value ? "text-white/70" : "text-muted-foreground"}`}>{role.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Non-engineer sign-up: plain Name field. Engineer sign-up: Name/Email/Password
                move inside the Engineer Profile box below instead of appearing here. */}
            {isSignUp && !isEngineerSignUp && (
              <div className="animate-fade-in">
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Smith"
                    maxLength={100}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>
            )}

            {!isEngineerSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      maxLength={255}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    />
                  </div>
                  {isSignUp && (
                    <p className="text-xs text-muted-foreground mt-1.5">Must be at least 8 characters</p>
                  )}
                </div>
              </>
            )}

            {/* ── Engineer profile box — Name/Email/Password + profile fields ── */}
            {isEngineerSignUp && (
              <div className="space-y-5 animate-fade-in rounded-xl border border-border p-4 bg-secondary/30">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wrench className="w-4 h-4 text-primary" />
                  Engineer Profile
                </div>
                <p className="text-xs text-muted-foreground -mt-3">
                  This information is reviewed by an admin before your account is activated.
                </p>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="engineer@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Residential Address</label>
                  <input
                    type="text"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    placeholder="Home / mailing address"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Specialty / Trade</label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. HVAC, Electrical, Networking"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">City</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">State</label>
                    <input type="text" value={state} onChange={(e) => setState(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Zip Code *</label>
                    <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Country</label>
                    <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Skills</label>
                  <div className="border border-input rounded-lg p-2 bg-background flex flex-wrap gap-2 items-center">
                    {skills.map((skill) => (
                      <span key={skill} className="bg-primary/20 text-primary px-2 py-1 rounded text-xs flex items-center gap-1.5">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} className="hover:text-destructive font-bold">×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={skillsInput}
                      onChange={(e) => setSkillsInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addSkillFromInput();
                        }
                      }}
                      onBlur={addSkillFromInput}
                      placeholder="Type a skill and press Enter"
                      className="flex-1 min-w-[120px] outline-none text-xs bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Certifications</label>
                  <div className="rounded-lg border border-input bg-background p-2">
                    <button
                      type="button"
                      onClick={() => setShowCertificationDropdown((prev) => !prev)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {certificationChoices.length > 0
                        ? certificationChoices.join(", ")
                        : "Select one or more certifications"}
                    </button>

                    {showCertificationDropdown && (
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-input bg-background p-2 shadow-sm">
                        {CERTIFICATION_OPTIONS.map((option) => (
                          <label
                            key={option}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-foreground hover:bg-muted/60"
                          >
                            <input
                              type="checkbox"
                              checked={option === "None" ? certificationChoices.length === 0 : certificationChoices.includes(option)}
                              onChange={() => toggleCertificationChoice(option)}
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground mt-2">
                      {certificationChoices.length > 0
                        ? `Selected: ${certificationChoices.join(", ")}`
                        : "Choose one or more certifications from the dropdown"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">ID Type *</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  >
                    <option value="">Select ID type</option>
                    {ID_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Upload ID Documents *</label>
                  <div className="rounded-lg border border-dashed border-input p-3 space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Front Side</label>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleIdFileChange(e, "front")} className="text-xs w-full mt-1" />
                      {frontIdFile && <p className="text-xs text-muted-foreground mt-1">Selected: {frontIdFile.name}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Back Side</label>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleIdFileChange(e, "back")} className="text-xs w-full mt-1" />
                      {backIdFile && <p className="text-xs text-muted-foreground mt-1">Selected: {backIdFile.name}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <Upload className="w-3 h-3 mt-0.5 shrink-0" /> Both front and back images are required.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-input bg-background p-3">
                  <label className="inline-flex items-start gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={ndaSigned}
                      onChange={(e) => setNdaSigned(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      I have read and signed the Engineering NDA / confidentiality agreement.
                      <span className="text-destructive ml-1">*</span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {!isSignUp && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-glow hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                resetEngineerFields();
              }}
              className="text-primary font-semibold hover:text-primary/80 transition-colors"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>

      {/* ── Approval confirmation popup (no admin selection — goes to shared review queue) ── */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background border border-border shadow-xl p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Send for Approval</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Your engineer application will be sent to an admin for review.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-input hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingApproval}
                onClick={confirmEngineerSubmit}
                className="flex-1 gradient-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {submittingApproval ? "Submitting..." : "Send for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
