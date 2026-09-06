import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Sparkles } from "lucide-react";
import { useAIStream } from "@/hooks/useAIStream";
import { toast } from "sonner";

interface VoiceNoteRecorderProps {
  jobId?: string;
  onTranscript?: (transcript: string, summary: string) => void;
}

const VoiceNoteRecorder = ({ onTranscript }: VoiceNoteRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const { content: summary, isStreaming, stream } = useAIStream();

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      toast.error("Speech recognition error: " + event.error);
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript("");
    toast.success("Recording started — speak your notes");
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const summarize = async () => {
    if (!transcript.trim()) return;
    const result = await stream("voice_summary", { transcript });
    if (result && onTranscript) {
      onTranscript(transcript, result);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${isRecording ? "bg-destructive animate-pulse" : "bg-muted"}`} />
        <span className="text-sm font-medium text-foreground">
          {isRecording ? "Recording..." : "Voice Notes"}
        </span>
      </div>

      <div className="flex gap-2">
        {!isRecording ? (
          <Button onClick={startRecording} size="sm" className="gap-2">
            <Mic className="w-4 h-4" /> Start Recording
          </Button>
        ) : (
          <Button onClick={stopRecording} size="sm" variant="destructive" className="gap-2">
            <Square className="w-4 h-4" /> Stop
          </Button>
        )}
        {transcript && !isRecording && (
          <Button onClick={summarize} size="sm" variant="outline" disabled={isStreaming} className="gap-2">
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Summarize
          </Button>
        )}
      </div>

      {transcript && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Transcript</label>
          <div className="text-sm text-foreground bg-muted/50 p-3 rounded-lg max-h-32 overflow-y-auto">
            {transcript}
          </div>
        </div>
      )}

      {summary && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-primary flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI Summary
          </label>
          <div className="text-sm text-foreground bg-primary/5 border border-primary/20 p-3 rounded-lg max-h-40 overflow-y-auto whitespace-pre-wrap">
            {summary}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceNoteRecorder;
