// import { useState, useRef, useEffect, useCallback } from "react";
// import { Bot, Send, X, Minimize2, Maximize2, Loader2, BarChart3, Users, Briefcase, TrendingUp, ShieldCheck, Zap, RotateCcw, Ticket, CircleHelp, ClipboardList, Search, MessageCircle, PlusCircle, RefreshCw, Volume2, VolumeX } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { Input } from "@/components/ui/input";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import ReactMarkdown from "react-markdown";
// import { toast } from "sonner";
// import { useAuth } from "@/hooks/useAuth";
// import { supabase } from "@/integrations/supabase/client";
// import { useQuery } from "@tanstack/react-query";

// type Msg = { role: "user" | "assistant"; content: string };

// const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
// const FLOATING_CONV_TITLE = "__floating_chat__";

// type QuickPrompt = { label: string; icon: React.ElementType; prompt: string };

// const adminPrompts: QuickPrompt[] = [
//   { label: "Platform Overview", icon: Zap, prompt: "Give me a comprehensive overview of the current platform status including active jobs, available engineers, and key metrics." },
//   { label: "Ticket Summary", icon: Ticket, prompt: "Show me a summary of all open and in-progress tickets. Highlight any urgent or high-priority tickets that need immediate attention." },
//   { label: "Revenue Analysis", icon: TrendingUp, prompt: "Analyze current revenue trends, margins, and provide insights on financial performance." },
//   { label: "Engineer Status", icon: Users, prompt: "Show me the current status of all engineers — who's available, their ratings, and workload." },
//   { label: "SLA Compliance", icon: ShieldCheck, prompt: "Review current SLA compliance rates, any breaches or at-risk jobs that need attention." },
//   { label: "Top Insights", icon: BarChart3, prompt: "What are the top actionable insights and recommendations for improving operations today?" },
// ];

// const clientPrompts: QuickPrompt[] = [
//   { label: "My Ticket Status", icon: Search, prompt: "Show me the status of all my current tickets. Include the subject, priority, and when each was created." },
//   { label: "Open Tickets", icon: Ticket, prompt: "List all my open and in-progress tickets with their current status and any updates." },
//   { label: "Raise a Concern", icon: MessageCircle, prompt: "I'd like to raise a concern about a service issue. What information do you need from me?" },
//   { label: "My Jobs", icon: Briefcase, prompt: "What's the status of my current service jobs? Are there any scheduled visits coming up?" },
//   { label: "Invoice Help", icon: ClipboardList, prompt: "Show me my recent invoices and their payment status. Are any overdue?" },
//   { label: "Get Help", icon: CircleHelp, prompt: "I need help with my service. Can you guide me through the support options available?" },
// ];

// const engineerPrompts: QuickPrompt[] = [
//   { label: "My Tickets", icon: Ticket, prompt: "Show me all tickets assigned to me. What's the priority and status of each?" },
//   { label: "Open Issues", icon: Search, prompt: "List all open tickets assigned to me that need my attention, sorted by priority." },
//   { label: "My Jobs", icon: Briefcase, prompt: "Show me my assigned jobs, their status, and any upcoming scheduled visits." },
//   { label: "Job Updates", icon: ClipboardList, prompt: "Help me draft a job status update for my current in-progress work." },
//   { label: "Troubleshooting", icon: CircleHelp, prompt: "I need troubleshooting guidance. What common issues should I check for in network installations?" },
//   { label: "Workload Review", icon: BarChart3, prompt: "Analyze my current workload — how many active jobs and tickets do I have? Am I at capacity?" },
// ];

// type TicketCategory = "complaint" | "support" | "billing" | "general";
// type TicketPriority = "low" | "medium" | "high" | "urgent";
// type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

// interface TicketForm {
//   subject: string;
//   description: string;
//   category: TicketCategory;
//   priority: TicketPriority;
// }

// const emptyTicket: TicketForm = {
//   subject: "",
//   description: "",
//   category: "general",
//   priority: "medium",
// };

// const playNotificationSound = () => {
//   try {
//     const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
//     const osc1 = ctx.createOscillator();
//     const osc2 = ctx.createOscillator();
//     const gain = ctx.createGain();
//     osc1.type = "sine";
//     osc1.frequency.setValueAtTime(880, ctx.currentTime);
//     osc1.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
//     osc2.type = "sine";
//     osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
//     osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.25);
//     gain.gain.setValueAtTime(0.15, ctx.currentTime);
//     gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
//     osc1.connect(gain);
//     osc2.connect(gain);
//     gain.connect(ctx.destination);
//     osc1.start(ctx.currentTime);
//     osc1.stop(ctx.currentTime + 0.15);
//     osc2.start(ctx.currentTime + 0.15);
//     osc2.stop(ctx.currentTime + 0.4);
//     setTimeout(() => ctx.close(), 500);
//   } catch {}
// };

// const FloatingAIChat = () => {
//   const { user } = useAuth();
//   const [open, setOpen] = useState(false);
//   const [expanded, setExpanded] = useState(false);
//   const [messages, setMessages] = useState<Msg[]>([]);
//   const [input, setInput] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [conversationId, setConversationId] = useState<string | null>(null);
//   const [loaded, setLoaded] = useState(false);
//   const [showTicketForm, setShowTicketForm] = useState(false);
//   const [ticketForm, setTicketForm] = useState<TicketForm>(emptyTicket);
//   const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
//   const [showTicketUpdate, setShowTicketUpdate] = useState(false);
//   const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
//   const [selectedNewStatus, setSelectedNewStatus] = useState<TicketStatus>("in_progress");
//   const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);
//   const [unreadNotifCount, setUnreadNotifCount] = useState(0);
//   const [soundMuted, setSoundMuted] = useState(() => localStorage.getItem("chat-sound-muted") === "true");
//   const scrollRef = useRef<HTMLDivElement>(null);

//   const toggleMute = () => {
//     setSoundMuted((prev) => {
//       const next = !prev;
//       localStorage.setItem("chat-sound-muted", String(next));
//       return next;
//     });
//   };

//   const { data: userRole } = useQuery({
//     queryKey: ["user-role-chat", user?.id],
//     queryFn: async () => {
//       const { data } = await supabase
//         .from("user_roles")
//         .select("role")
//         .eq("user_id", user!.id)
//         .limit(1);
//       return data?.[0]?.role ?? "admin";
//     },
//     enabled: !!user?.id,
//   });

//   // Get client_id for the current user
//   const { data: clientRecord } = useQuery({
//     queryKey: ["client-record-chat", user?.id],
//     queryFn: async () => {
//       const { data } = await supabase
//         .from("clients")
//         .select("id")
//         .eq("user_id", user!.id)
//         .limit(1)
//         .maybeSingle();
//       return data;
//     },
//     enabled: !!user?.id && userRole === "client",
//   });

//   // Get engineer record for engineer users
//   const { data: engineerRecord } = useQuery({
//     queryKey: ["engineer-record-chat", user?.id],
//     queryFn: async () => {
//       const { data } = await supabase
//         .from("engineers")
//         .select("id")
//         .eq("user_id", user!.id)
//         .limit(1)
//         .maybeSingle();
//       return data;
//     },
//     enabled: !!user?.id && userRole === "engineer",
//   });

//   // Fetch engineer's assigned tickets for the update panel
//   const { data: engineerTickets = [], refetch: refetchTickets } = useQuery({
//     queryKey: ["engineer-tickets-chat", user?.id],
//     queryFn: async () => {
//       const { data } = await supabase
//         .from("tickets")
//         .select("id, subject, status, priority, category, updated_at")
//         .eq("assigned_to", user!.id)
//         .in("status", ["open", "in_progress"])
//         .order("priority", { ascending: true })
//         .limit(20);
//       return data ?? [];
//     },
//     enabled: !!user?.id && userRole === "engineer",
//   });

//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//     }
//   }, [messages, showTicketForm]);

//   // Real-time ticket status notifications
//   useEffect(() => {
//     if (!user || !userRole) return;

//     // Determine filter based on role
//     const filterColumn =
//       userRole === "client" && clientRecord?.id
//         ? "client_id"
//         : userRole === "engineer" && engineerRecord?.id
//         ? "assigned_to"
//         : userRole === "admin" || userRole === "team_lead"
//         ? null // admins see all
//         : undefined; // no subscription

//     if (filterColumn === undefined) return;

//     const filterValue =
//       filterColumn === "client_id"
//         ? clientRecord!.id
//         : filterColumn === "assigned_to"
//         ? engineerRecord!.id
//         : null;

//     const channelFilter = filterColumn && filterValue
//       ? `${filterColumn}=eq.${filterValue}`
//       : undefined;

//     const channel = supabase
//       .channel("ticket-updates-chat")
//       .on(
//         "postgres_changes",
//         {
//           event: "UPDATE",
//           schema: "public",
//           table: "tickets",
//           ...(channelFilter ? { filter: channelFilter } : {}),
//         },
//         (payload) => {
//           const ticket = payload.new as any;
//           const old = payload.old as any;

//           // Only notify on status changes
//           if (ticket.status === old.status) return;

//           const statusLabel = ticket.status.replace("_", " ");
//           const notifMsg = `🔔 **Ticket Updated**\n\n- **Subject:** ${ticket.subject}\n- **Status:** ${old.status.replace("_", " ")} → **${statusLabel}**\n- **Priority:** ${ticket.priority}${ticket.resolved_at ? "\n- ✅ Resolved" : ""}`;

//           setMessages((prev) => [...prev, { role: "assistant", content: notifMsg }]);
//           if (!soundMuted) playNotificationSound();
//           if (!open) setUnreadNotifCount((c) => c + 1);

//           // Persist notification to conversation if exists
//           if (conversationId) {
//             supabase.from("chat_messages").insert({
//               conversation_id: conversationId,
//               role: "assistant",
//               content: notifMsg,
//             });
//           }
//         }
//       )
//       .subscribe();

//     return () => {
//       supabase.removeChannel(channel);
//     };
//   }, [user, userRole, clientRecord?.id, engineerRecord?.id, conversationId, soundMuted]);

//   useEffect(() => {
//     if (!user || loaded) return;
//     (async () => {
//       const { data: conv } = await supabase
//         .from("chat_conversations")
//         .select("id")
//         .eq("user_id", user.id)
//         .eq("title", FLOATING_CONV_TITLE)
//         .order("updated_at", { ascending: false })
//         .limit(1)
//         .maybeSingle();

//       if (conv) {
//         setConversationId(conv.id);
//         const { data: msgs } = await supabase
//           .from("chat_messages")
//           .select("role, content")
//           .eq("conversation_id", conv.id)
//           .order("created_at", { ascending: true });
//         if (msgs && msgs.length > 0) {
//           setMessages(msgs.map((m) => ({ role: m.role as Msg["role"], content: m.content })));
//         }
//       }
//       setLoaded(true);
//     })();
//   }, [user, loaded]);

//   const getOrCreateConversation = useCallback(async (): Promise<string> => {
//     if (conversationId) return conversationId;
//     const { data, error } = await supabase
//       .from("chat_conversations")
//       .insert({ user_id: user!.id, title: FLOATING_CONV_TITLE })
//       .select("id")
//       .single();
//     if (error) throw error;
//     setConversationId(data.id);
//     return data.id;
//   }, [conversationId, user]);

//   const saveMessage = useCallback(async (convId: string, role: string, content: string) => {
//     await supabase.from("chat_messages").insert({ conversation_id: convId, role, content });
//   }, []);

//   const startNewChat = useCallback(async () => {
//     setMessages([]);
//     setConversationId(null);
//     setShowTicketForm(false);
//     setShowTicketUpdate(false);
//   }, []);

//   const handleSubmitTicket = async () => {
//     if (!ticketForm.subject.trim()) {
//       toast.error("Please enter a ticket subject");
//       return;
//     }
//     if (!clientRecord?.id) {
//       toast.error("Client record not found. Please contact support.");
//       return;
//     }

//     setIsSubmittingTicket(true);
//     try {
//       const { data: ticket, error } = await supabase
//         .from("tickets")
//         .insert({
//           subject: ticketForm.subject.trim(),
//           description: ticketForm.description.trim() || null,
//           category: ticketForm.category,
//           priority: ticketForm.priority,
//           client_id: clientRecord.id,
//           status: "open",
//         })
//         .select("id, subject, priority, category")
//         .single();

//       if (error) throw error;

//       setShowTicketForm(false);
//       setTicketForm(emptyTicket);

//       // Add a confirmation message in the chat
//       const confirmMsg = `✅ **Ticket Created Successfully!**\n\n- **Subject:** ${ticket.subject}\n- **Priority:** ${ticket.priority}\n- **Category:** ${ticket.category}\n- **Status:** Open\n\nYour ticket has been submitted and our team will review it shortly. You can ask me "My Ticket Status" anytime to check on it.`;

//       const convId = await getOrCreateConversation();
//       setMessages((prev) => [...prev, { role: "assistant", content: confirmMsg }]);
//       await saveMessage(convId, "assistant", confirmMsg);

//       toast.success("Ticket created successfully!");
//     } catch (e: any) {
//       console.error("Ticket creation error:", e);
//       toast.error(e.message || "Failed to create ticket");
//     } finally {
//       setIsSubmittingTicket(false);
//     }
//   };

//   const handleUpdateTicket = async () => {
//     if (!selectedTicketId) {
//       toast.error("Please select a ticket");
//       return;
//     }

//     setIsUpdatingTicket(true);
//     try {
//       const resolvedAt = selectedNewStatus === "resolved" || selectedNewStatus === "closed"
//         ? new Date().toISOString()
//         : null;

//       const { error } = await supabase
//         .from("tickets")
//         .update({
//           status: selectedNewStatus,
//           ...(resolvedAt ? { resolved_at: resolvedAt } : {}),
//         })
//         .eq("id", selectedTicketId);

//       if (error) throw error;

//       const ticket = engineerTickets.find((t: any) => t.id === selectedTicketId);
//       const statusLabel = selectedNewStatus.replace("_", " ");
//       const confirmMsg = `✅ **Ticket Status Updated**\n\n- **Subject:** ${ticket?.subject || "Ticket"}\n- **New Status:** ${statusLabel}\n- **Priority:** ${ticket?.priority || "N/A"}${resolvedAt ? "\n- ✅ Marked as resolved" : ""}`;

//       setShowTicketUpdate(false);
//       setSelectedTicketId(null);
//       setSelectedNewStatus("in_progress");

//       const convId = await getOrCreateConversation();
//       setMessages((prev) => [...prev, { role: "assistant", content: confirmMsg }]);
//       await saveMessage(convId, "assistant", confirmMsg);
//       refetchTickets();

//       toast.success("Ticket status updated!");
//     } catch (e: any) {
//       console.error("Ticket update error:", e);
//       toast.error(e.message || "Failed to update ticket");
//     } finally {
//       setIsUpdatingTicket(false);
//     }
//   };

//   if (!user) return null;

//   const quickPrompts = userRole === "client" ? clientPrompts : userRole === "engineer" ? engineerPrompts : adminPrompts;
//   const roleLabel = userRole === "client" ? "Customer Support" : userRole === "engineer" ? "Engineer Assistant" : "Operations AI";
//   const roleSubtext = userRole === "client"
//     ? "Check tickets, job status, invoices, and get support."
//     : userRole === "engineer"
//     ? "View assigned tickets, jobs, and get troubleshooting help."
//     : "Ask about jobs, engineers, tickets, revenue, or anything on the platform.";

//   const sendMessage = async (text: string) => {
//     if (!text.trim() || isLoading) return;
//     const userMsg: Msg = { role: "user", content: text.trim() };
//     const allMessages = [...messages, userMsg];
//     setMessages(allMessages);
//     setInput("");
//     setIsLoading(true);
//     setShowTicketForm(false);

//     let assistantSoFar = "";

//     try {
//       const convId = await getOrCreateConversation();
//       await saveMessage(convId, "user", text.trim());

//       const resp = await fetch(CHAT_URL, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
//         },
//         body: JSON.stringify({
//           messages: allMessages,
//           userRole: userRole || "admin",
//           userId: user.id,
//         }),
//       });

//       if (!resp.ok) {
//         const err = await resp.json().catch(() => ({ error: "Request failed" }));
//         toast.error(err.error || "AI request failed");
//         setIsLoading(false);
//         return;
//       }

//       if (!resp.body) throw new Error("No response body");

//       const reader = resp.body.getReader();
//       const decoder = new TextDecoder();
//       let buffer = "";

//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;
//         buffer += decoder.decode(value, { stream: true });

//         let newlineIdx: number;
//         while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
//           let line = buffer.slice(0, newlineIdx);
//           buffer = buffer.slice(newlineIdx + 1);
//           if (line.endsWith("\r")) line = line.slice(0, -1);
//           if (line.startsWith(":") || line.trim() === "") continue;
//           if (!line.startsWith("data: ")) continue;
//           const jsonStr = line.slice(6).trim();
//           if (jsonStr === "[DONE]") break;
//           try {
//             const parsed = JSON.parse(jsonStr);
//             const content = parsed.choices?.[0]?.delta?.content;
//             if (content) {
//               assistantSoFar += content;
//               const snapshot = assistantSoFar;
//               setMessages((prev) => {
//                 const last = prev[prev.length - 1];
//                 if (last?.role === "assistant") {
//                   return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snapshot } : m));
//                 }
//                 return [...prev, { role: "assistant", content: snapshot }];
//               });
//             }
//           } catch {
//             buffer = line + "\n" + buffer;
//             break;
//           }
//         }
//       }

//       if (assistantSoFar) {
//         await saveMessage(convId, "assistant", assistantSoFar);
//         await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
//       }
//     } catch (e) {
//       console.error(e);
//       toast.error("Failed to connect to AI assistant");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       sendMessage(input);
//     }
//   };

//   // Global event: other components can open the chat with a pre-filled prompt
//   const sendRef = useRef(sendMessage);
//   useEffect(() => { sendRef.current = sendMessage; });
//   useEffect(() => {
//     const handler = (e: Event) => {
//       const detail = (e as CustomEvent).detail || {};
//       setOpen(true);
//       setUnreadNotifCount(0);
//       if (detail.prompt) {
//         setInput(detail.prompt);
//         if (detail.autoSend !== false) {
//           setTimeout(() => sendRef.current(detail.prompt), 50);
//         }
//       }
//     };
//     window.addEventListener("ai-assistant-open", handler);
//     return () => window.removeEventListener("ai-assistant-open", handler);
//   }, []);

//   return (
//     <>
//       {/* FAB */}
//       {!open && (
//         <button
//           onClick={() => { setOpen(true); setUnreadNotifCount(0); }}
//           className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${unreadNotifCount > 0 ? "animate-bounce" : ""}`}
//           aria-label="Open AI Assistant"
//         >
//           <MessageCircle className="w-6 h-6" />
//           {unreadNotifCount > 0 && (
//             <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive border-2 border-background animate-pulse flex items-center justify-center text-[10px] font-bold text-destructive-foreground">
//               {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
//             </span>
//           )}
//         </button>
//       )}

//       {/* Chat Panel */}
//       {open && (
//         <div
//           className={`fixed z-50 bg-background border border-border rounded-2xl shadow-2xl flex flex-col transition-all ${
//             expanded
//               ? "bottom-4 right-4 left-4 top-4 sm:left-auto sm:top-auto sm:w-[600px] sm:h-[700px]"
//               : "bottom-6 right-6 w-[380px] h-[520px]"
//           }`}
//         >
//           {/* Header */}
//           <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
//             <div className="flex items-center gap-2">
//               <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
//                 <Bot className="w-4 h-4 text-primary" />
//               </div>
//               <div>
//                 <h3 className="text-sm font-semibold text-foreground">{roleLabel}</h3>
//                 <p className="text-xs text-muted-foreground">FieldFlow AI</p>
//               </div>
//             </div>
//             <div className="flex items-center gap-1">
//               {messages.length > 0 && (
//                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewChat} title="New chat">
//                   <RotateCcw className="w-3.5 h-3.5" />
//                 </Button>
//               )}
//               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMute} title={soundMuted ? "Unmute notifications" : "Mute notifications"}>
//                 {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
//               </Button>
//               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
//                 {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
//               </Button>
//               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
//                 <X className="w-3.5 h-3.5" />
//               </Button>
//             </div>
//           </div>

//           {/* Messages */}
//           <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
//             {messages.length === 0 && !showTicketForm && (
//               <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
//                 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
//                   <Bot className="w-6 h-6 text-primary" />
//                 </div>
//                 <p className="text-sm font-medium text-foreground">How can I help?</p>
//                 <p className="text-xs text-muted-foreground max-w-[260px]">{roleSubtext}</p>
//                 <div className="grid grid-cols-2 gap-2 w-full mt-2">
//                   {quickPrompts.map((item) => (
//                     <button
//                       key={item.label}
//                       onClick={() => sendMessage(item.prompt)}
//                       className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent text-left text-xs text-foreground transition-colors"
//                     >
//                       <item.icon className="w-3.5 h-3.5 text-primary shrink-0" />
//                       <span>{item.label}</span>
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             )}
//             <div className="space-y-3">
//               {messages.map((msg, i) => (
//                 <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
//                   <div
//                     className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
//                       msg.role === "user"
//                         ? "bg-primary text-primary-foreground"
//                         : "bg-muted text-foreground"
//                     }`}
//                   >
//                     {msg.role === "assistant" ? (
//                       <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
//                         <ReactMarkdown>{msg.content}</ReactMarkdown>
//                       </div>
//                     ) : (
//                       <p className="whitespace-pre-wrap">{msg.content}</p>
//                     )}
//                   </div>
//                 </div>
//               ))}
//               {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
//                 <div className="flex justify-start">
//                   <div className="bg-muted rounded-xl px-3 py-2">
//                     <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
//                   </div>
//                 </div>
//               )}

//               {/* Inline Ticket Creation Form */}
//               {showTicketForm && (
//                 <div className="bg-card border border-border rounded-xl p-3 space-y-3">
//                   <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
//                     <PlusCircle className="w-4 h-4 text-primary" />
//                     Create New Ticket
//                   </div>
//                   <div className="space-y-2">
//                     <Input
//                       placeholder="Subject *"
//                       value={ticketForm.subject}
//                       onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
//                       className="text-sm h-9"
//                       maxLength={255}
//                     />
//                     <Textarea
//                       placeholder="Describe your issue..."
//                       value={ticketForm.description}
//                       onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))}
//                       className="text-sm min-h-[60px] max-h-[100px] resize-none"
//                       rows={2}
//                       maxLength={1000}
//                     />
//                     <div className="grid grid-cols-2 gap-2">
//                       <Select
//                         value={ticketForm.category}
//                         onValueChange={(v) => setTicketForm((f) => ({ ...f, category: v as TicketCategory }))}
//                       >
//                         <SelectTrigger className="text-xs h-8">
//                           <SelectValue placeholder="Category" />
//                         </SelectTrigger>
//                         <SelectContent>
//                           <SelectItem value="general">General</SelectItem>
//                           <SelectItem value="support">Support</SelectItem>
//                           <SelectItem value="billing">Billing</SelectItem>
//                           <SelectItem value="complaint">Complaint</SelectItem>
//                         </SelectContent>
//                       </Select>
//                       <Select
//                         value={ticketForm.priority}
//                         onValueChange={(v) => setTicketForm((f) => ({ ...f, priority: v as TicketPriority }))}
//                       >
//                         <SelectTrigger className="text-xs h-8">
//                           <SelectValue placeholder="Priority" />
//                         </SelectTrigger>
//                         <SelectContent>
//                           <SelectItem value="low">Low</SelectItem>
//                           <SelectItem value="medium">Medium</SelectItem>
//                           <SelectItem value="high">High</SelectItem>
//                           <SelectItem value="urgent">Urgent</SelectItem>
//                         </SelectContent>
//                       </Select>
//                     </div>
//                     <div className="flex gap-2 pt-1">
//                       <Button
//                         size="sm"
//                         className="flex-1 h-8 text-xs"
//                         onClick={handleSubmitTicket}
//                         disabled={isSubmittingTicket || !ticketForm.subject.trim()}
//                       >
//                         {isSubmittingTicket ? (
//                           <Loader2 className="w-3 h-3 animate-spin mr-1" />
//                         ) : (
//                           <Send className="w-3 h-3 mr-1" />
//                         )}
//                         Submit Ticket
//                       </Button>
//                       <Button
//                         size="sm"
//                         variant="outline"
//                         className="h-8 text-xs"
//                         onClick={() => {
//                           setShowTicketForm(false);
//                           setTicketForm(emptyTicket);
//                         }}
//                       >
//                         Cancel
//                       </Button>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {/* Inline Ticket Update Panel for Engineers */}
//               {showTicketUpdate && userRole === "engineer" && (
//                 <div className="bg-card border border-border rounded-xl p-3 space-y-3">
//                   <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
//                     <RefreshCw className="w-4 h-4 text-primary" />
//                     Update Ticket Status
//                   </div>
//                   {engineerTickets.length === 0 ? (
//                     <p className="text-xs text-muted-foreground">No open tickets assigned to you.</p>
//                   ) : (
//                     <div className="space-y-2">
//                       <Select
//                         value={selectedTicketId || ""}
//                         onValueChange={(v) => setSelectedTicketId(v)}
//                       >
//                         <SelectTrigger className="text-xs h-9">
//                           <SelectValue placeholder="Select a ticket..." />
//                         </SelectTrigger>
//                         <SelectContent>
//                           {engineerTickets.map((t: any) => (
//                             <SelectItem key={t.id} value={t.id}>
//                               <span className="flex items-center gap-1.5">
//                                 <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.priority === "urgent" ? "bg-destructive" : t.priority === "high" ? "bg-orange-500" : "bg-primary"}`} />
//                                 {t.subject.length > 35 ? t.subject.slice(0, 35) + "…" : t.subject}
//                               </span>
//                             </SelectItem>
//                           ))}
//                         </SelectContent>
//                       </Select>
//                       <Select
//                         value={selectedNewStatus}
//                         onValueChange={(v) => setSelectedNewStatus(v as TicketStatus)}
//                       >
//                         <SelectTrigger className="text-xs h-8">
//                           <SelectValue placeholder="New status" />
//                         </SelectTrigger>
//                         <SelectContent>
//                           <SelectItem value="open">Open</SelectItem>
//                           <SelectItem value="in_progress">In Progress</SelectItem>
//                           <SelectItem value="resolved">Resolved</SelectItem>
//                           <SelectItem value="closed">Closed</SelectItem>
//                         </SelectContent>
//                       </Select>
//                       <div className="flex gap-2 pt-1">
//                         <Button
//                           size="sm"
//                           className="flex-1 h-8 text-xs"
//                           onClick={handleUpdateTicket}
//                           disabled={isUpdatingTicket || !selectedTicketId}
//                         >
//                           {isUpdatingTicket ? (
//                             <Loader2 className="w-3 h-3 animate-spin mr-1" />
//                           ) : (
//                             <RefreshCw className="w-3 h-3 mr-1" />
//                           )}
//                           Update Status
//                         </Button>
//                         <Button
//                           size="sm"
//                           variant="outline"
//                           className="h-8 text-xs"
//                           onClick={() => {
//                             setShowTicketUpdate(false);
//                             setSelectedTicketId(null);
//                           }}
//                         >
//                           Cancel
//                         </Button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>
//           </ScrollArea>

//           {/* Input + action links */}
//           <div className="px-4 py-3 border-t border-border shrink-0">
//             {userRole === "client" && !showTicketForm && (
//               <button
//                 onClick={() => setShowTicketForm(true)}
//                 className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mb-2 transition-colors"
//               >
//                 <PlusCircle className="w-3.5 h-3.5" />
//                 Create a new support ticket
//               </button>
//             )}
//             {userRole === "engineer" && !showTicketUpdate && (
//               <button
//                 onClick={() => { setShowTicketUpdate(true); refetchTickets(); }}
//                 className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mb-2 transition-colors"
//               >
//                 <RefreshCw className="w-3.5 h-3.5" />
//                 Update a ticket status
//               </button>
//             )}
//             <div className="flex gap-2">
//               <Textarea
//                 value={input}
//                 onChange={(e) => setInput(e.target.value)}
//                 onKeyDown={handleKeyDown}
//                 placeholder={userRole === "client" ? "Ask about tickets, jobs, or invoices..." : userRole === "engineer" ? "Ask about your tickets, jobs, or troubleshooting..." : "Ask anything..."}
//                 className="min-h-[40px] max-h-[100px] resize-none text-sm"
//                 rows={1}
//               />
//               <Button
//                 size="icon"
//                 onClick={() => sendMessage(input)}
//                 disabled={!input.trim() || isLoading}
//                 className="shrink-0 h-10 w-10"
//               >
//                 <Send className="w-4 h-4" />
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// };

// export default FloatingAIChat;
