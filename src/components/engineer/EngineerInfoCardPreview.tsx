import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Share2, Copy, Loader2, Check, Link2, FileText } from "lucide-react";
import EngineerInfoCard, {
  type EngineerInfoCardData,
} from "./EngineerInfoCard";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: EngineerInfoCardData;
  /** Public URL used for the QR code + share link. */
  shareUrl?: string;
}

export default function EngineerInfoCardPreview({
  open,
  onOpenChange,
  data,
  shareUrl,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"none" | "download" | "pdf" | "share">("none");
  const [copied, setCopied] = useState(false);

  // Generate the QR each time the dialog opens or the share URL changes.
  useEffect(() => {
    let cancelled = false;
    if (!open || !shareUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(shareUrl, { margin: 1, width: 192 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  const cardData = useMemo<EngineerInfoCardData>(
    () => ({ ...data, qrDataUrl, shareUrl }),
    [data, qrDataUrl, shareUrl],
  );

  const fileBaseName = (data.fullName ?? "engineer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "engineer";

  const renderToBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const blob = await renderToBlob();
      if (!blob) throw new Error("Card not ready");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBaseName}-info-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Info card downloaded");
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    } finally {
      setBusy("none");
    }
  };

  const handleDownloadPdf = async () => {
    if (!cardRef.current) return;
    setBusy("pdf");
    try {
      const node = cardRef.current;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor:
          getComputedStyle(document.body).backgroundColor || "#ffffff",
      });

      // Card is 360 CSS px wide. Use its actual aspect ratio to size the
      // image inside an A4 portrait page with comfortable margins.
      const rect = node.getBoundingClientRect();
      const aspect = rect.height / rect.width;

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2 - 20; // leave room for footer line
      let imgW = maxW;
      let imgH = imgW * aspect;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = imgH / aspect;
      }
      const x = (pageW - imgW) / 2;
      const y = margin;

      pdf.addImage(dataUrl, "PNG", x, y, imgW, imgH, undefined, "FAST");

      // Footer with share link if available
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      const footer = shareUrl
        ? `Public profile: ${shareUrl}`
        : `${data.fullName ?? "Engineer"} — info card`;
      pdf.text(footer, pageW / 2, pageH - 10, { align: "center", maxWidth: maxW });

      pdf.save(`${fileBaseName}-info-card.pdf`);
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error(e.message || "PDF export failed");
    } finally {
      setBusy("none");
    }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      const blob = await renderToBlob();
      const file = blob
        ? new File([blob], `${fileBaseName}-info-card.png`, { type: "image/png" })
        : null;

      const nav: any = navigator;
      const sharePayload: ShareData = {
        title: `${data.fullName ?? "Engineer"} — info card`,
        text: `${data.fullName ?? "Engineer"}${
          data.specialty ? ` · ${data.specialty}` : ""
        }`,
        url: shareUrl,
      };
      if (file && nav.canShare?.({ files: [file] })) {
        await nav.share({ ...sharePayload, files: [file] });
        toast.success("Shared");
      } else if (nav.share) {
        await nav.share(sharePayload);
        toast.success("Shared");
      } else if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied to clipboard");
      } else {
        toast.error("Sharing isn't supported on this device");
      }
    } catch (e: any) {
      // User cancellation throws AbortError — don't surface that as an error.
      if (e?.name !== "AbortError") {
        toast.error(e.message || "Share failed");
      }
    } finally {
      setBusy("none");
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your info card</DialogTitle>
          <DialogDescription>
            Preview how your card looks, then share or download a copy.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <EngineerInfoCard ref={cardRef} data={cardData} />
        </div>

        {shareUrl && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Public profile link
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
                aria-label="Public profile link"
              />
              <Button
                type="button"
                variant={copied ? "default" : "outline"}
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleShare}
            disabled={busy !== "none"}
          >
            {busy === "share" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4 mr-2" />
            )}
            Share
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={busy !== "none"}
          >
            {busy === "pdf" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={busy !== "none"}
          >
            {busy === "download" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
