import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import EngineerInfoCard, {
  type EngineerInfoCardData,
} from "@/components/engineer/EngineerInfoCard";

interface PublicEngineer extends EngineerInfoCardData {
  id: string;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/engineer-public-profile`;

export default function PublicEngineerProfile() {
  const { id } = useParams();
  const [data, setData] = useState<PublicEngineer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<string | null>(null);

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : ""),
    [],
  );

  const fetchProfile = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const r = await fetch(`${FN_URL}?id=${encodeURIComponent(id)}&t=${Date.now()}`, {
          signal,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          cache: "no-store",
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error ?? "Not found");
        }
        const d = await r.json();
        setData(d);
        setError(null);
        // SEO
        document.title = `${d.fullName ?? "Engineer"} — Field engineer profile`;
        const desc = `${d.fullName ?? "Engineer"}${
          d.specialty ? ` · ${d.specialty}` : ""
        }${d.location ? ` in ${d.location}` : ""}.`;
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "description");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", desc.slice(0, 160));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e.message);
      }
    },
    [id],
  );

  // Initial load
  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetchProfile(ctrl.signal).finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [id, fetchProfile]);

  // Refetch when the tab becomes visible / regains focus, so toggle changes
  // made elsewhere appear without a manual refresh.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchProfile();
    };
    window.addEventListener("focus", fetchProfile as any);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", fetchProfile as any);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchProfile]);

  // Live updates: refetch when this engineer's row changes.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`public-engineer-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "engineers", filter: `id=eq.${id}` },
        () => fetchProfile(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchProfile]);

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 192 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [shareUrl]);

  const cardData = useMemo<EngineerInfoCardData | null>(
    () => (data ? { ...data, qrDataUrl: qr } : null),
    [data, qr],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <span className="text-xs text-muted-foreground">
            Public engineer profile
          </span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading profile…
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <h1 className="text-xl font-semibold mb-2">Profile unavailable</h1>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        )}

        {cardData && !loading && (
          <div className="grid md:grid-cols-[auto,1fr] gap-8 items-start">
            <div className="flex justify-center">
              <EngineerInfoCard data={cardData} />
            </div>
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">
                {cardData.fullName ?? "Engineer"}
              </h1>
              {cardData.specialty && (
                <p className="text-muted-foreground">{cardData.specialty}</p>
              )}
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Rating</dt>
                  <dd className="font-medium">
                    {Number(cardData.rating ?? 0).toFixed(1)} / 5
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Jobs completed</dt>
                  <dd className="font-medium">{cardData.jobsCompleted ?? 0}</dd>
                </div>
                {cardData.location && (
                  <div>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">{cardData.location}</dd>
                  </div>
                )}
                {cardData.insuranceVerified && (
                  <div>
                    <dt className="text-muted-foreground">Insurance</dt>
                    <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                      Verified
                    </dd>
                  </div>
                )}
              </dl>

              {cardData.skills && cardData.skills.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-2">Skills</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {cardData.skills.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-2 py-1 rounded-full bg-muted border border-border"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-4 border-t border-border">
                Contact details are kept private. To book this engineer, use
                the dispatch portal.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
