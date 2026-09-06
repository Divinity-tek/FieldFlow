import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props { engineerId: string; jobId?: string | null; className?: string }

export default function SosButton({ engineerId, jobId, className }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }),
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* ignore */ }
    const { error } = await supabase.from("engineer_sos_events").insert({
      engineer_id: engineerId,
      job_id: jobId ?? null,
      lat, lng, note: note.trim() || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Help requested. Dispatch has been alerted.");
    setOpen(false);
    setNote("");
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
      >
        <ShieldAlert className="w-4 h-4 mr-1.5" /> SOS
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request urgent help?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends your current location to dispatch. Add a short note if you can.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What's happening? (optional)" maxLength={300} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={send} disabled={sending} className="bg-destructive hover:bg-destructive/90">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ShieldAlert className="w-4 h-4 mr-1.5" />}
              Send SOS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
