import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME = `👋 Hi! I'm the FieldFlow assistant. I can help you with:

• **Service information** — what we offer, pricing tiers, coverage areas
• **Ticket status updates** — check your existing service request
• **Getting started** — how to sign up and book your first job

How can I help you today?`;

const LandingChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "welcome", role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await supabase.functions.invoke("landing-chat", {
        body: { messages: history },
      });

      const reply = res.data?.reply || "Sorry, I couldn't process that. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong. Please try again later." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    "What services do you offer?",
    "How do I check my ticket status?",
    "What areas do you cover?",
  ];

  return (
    <>
      {open && (
        <div className="fixed z-[60] bottom-20 right-4 w-[370px] h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary-foreground" />
              <div>
                <h4 className="text-sm font-semibold text-primary-foreground">FieldFlow Assistant</h4>
                <p className="text-[10px] text-primary-foreground/70">Service info & ticket updates</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-primary-foreground/10 text-primary-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ul]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Quick actions (only if just welcome message) */}
          {messages.length === 1 && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5">
              {quickActions.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => {
                      setInput(q);
                      const fakeEvent = { preventDefault: () => {} };
                      // trigger send
                    }, 0);
                    setInput("");
                    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: q };
                    setMessages((prev) => [...prev, userMsg]);
                    setLoading(true);

                    supabase.functions
                      .invoke("landing-chat", {
                        body: { messages: [{ role: "user", content: q }] },
                      })
                      .then((res) => {
                        const reply = res.data?.reply || "Sorry, please try again.";
                        setMessages((prev) => [
                          ...prev,
                          { id: crypto.randomUUID(), role: "assistant", content: reply },
                        ]);
                      })
                      .catch(() => {
                        setMessages((prev) => [
                          ...prev,
                          { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong." },
                        ]);
                      })
                      .finally(() => setLoading(false));
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-xs hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about our services..."
              className="flex-1 bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-[61] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
};

export default LandingChatWidget;
