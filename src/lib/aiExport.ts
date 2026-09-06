import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";

export type ExportMsg = { role: "user" | "assistant"; content: string };

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80) || "conversation";

// ── Markdown → docx conversion ──────────────────────────────────────────────

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function inlineRuns(tokens: Tokens.Generic[] | undefined, base: { bold?: boolean; italics?: boolean; code?: boolean; strike?: boolean } = {}): TextRun[] {
  const runs: TextRun[] = [];
  if (!tokens) return runs;
  for (const t of tokens) {
    switch (t.type) {
      case "text":
      case "escape":
        if ("tokens" in t && (t as Tokens.Text).tokens) {
          runs.push(...inlineRuns((t as Tokens.Text).tokens as Tokens.Generic[], base));
        } else {
          runs.push(new TextRun({ text: (t as Tokens.Text).text, ...base, font: base.code ? "Courier New" : undefined }));
        }
        break;
      case "strong":
        runs.push(...inlineRuns((t as Tokens.Strong).tokens as Tokens.Generic[], { ...base, bold: true }));
        break;
      case "em":
        runs.push(...inlineRuns((t as Tokens.Em).tokens as Tokens.Generic[], { ...base, italics: true }));
        break;
      case "del":
        runs.push(...inlineRuns((t as Tokens.Del).tokens as Tokens.Generic[], { ...base, strike: true }));
        break;
      case "codespan":
        runs.push(new TextRun({ text: (t as Tokens.Codespan).text, font: "Courier New", ...base }));
        break;
      case "link": {
        const link = t as Tokens.Link;
        const inner = inlineRuns(link.tokens as Tokens.Generic[], { ...base });
        runs.push(...inner);
        runs.push(new TextRun({ text: ` (${link.href})`, italics: true, color: "2563EB" }));
        break;
      }
      case "br":
        runs.push(new TextRun({ text: "", break: 1 }));
        break;
      case "image":
        runs.push(new TextRun({ text: `[image: ${(t as Tokens.Image).text || (t as Tokens.Image).href}]`, italics: true }));
        break;
      default:
        if ("text" in t && typeof (t as unknown as { text?: unknown }).text === "string") {
          runs.push(new TextRun({ text: (t as unknown as { text: string }).text, ...base }));
        }
    }
  }
  return runs;
}

function tokensToParagraphs(md: string): Paragraph[] {
  const tokens = marked.lexer(md);
  const out: Paragraph[] = [];

  const walkList = (list: Tokens.List, depth = 0) => {
    list.items.forEach((item, idx) => {
      const prefix = list.ordered ? `${Number(list.start ?? 1) + idx}. ` : "• ";
      const indent = "    ".repeat(depth);
      const firstText = item.tokens.find((t) => t.type === "text") as Tokens.Text | undefined;
      const runs: TextRun[] = [new TextRun({ text: indent + prefix })];
      if (firstText) {
        const inner = (firstText.tokens as Tokens.Generic[] | undefined);
        runs.push(...inlineRuns(inner ?? [{ type: "text", text: firstText.text, raw: firstText.text } as unknown as Tokens.Generic]));
      }
      out.push(new Paragraph({ children: runs }));
      // Nested lists
      item.tokens.forEach((sub) => {
        if (sub.type === "list") walkList(sub as Tokens.List, depth + 1);
      });
    });
  };

  for (const tok of tokens) {
    switch (tok.type) {
      case "heading": {
        const h = tok as Tokens.Heading;
        out.push(new Paragraph({
          heading: HEADING_MAP[h.depth] ?? HeadingLevel.HEADING_3,
          children: inlineRuns(h.tokens as Tokens.Generic[], { bold: true }),
        }));
        break;
      }
      case "paragraph": {
        const p = tok as Tokens.Paragraph;
        out.push(new Paragraph({ children: inlineRuns(p.tokens as Tokens.Generic[]) }));
        break;
      }
      case "blockquote": {
        const bq = tok as Tokens.Blockquote;
        const inner = tokensToParagraphs(bq.text);
        inner.forEach((p) =>
          out.push(new Paragraph({
            children: [new TextRun({ text: "▎ ", color: "9CA3AF" }), ...((p as unknown as { options: { children: TextRun[] } }).options?.children ?? [])],
          }))
        );
        break;
      }
      case "list":
        walkList(tok as Tokens.List);
        out.push(new Paragraph({ text: "" }));
        break;
      case "code": {
        const c = tok as Tokens.Code;
        c.text.split("\n").forEach((line) =>
          out.push(new Paragraph({
            children: [new TextRun({ text: line || " ", font: "Courier New", size: 20 })],
            shading: { type: "clear", color: "auto", fill: "F3F4F6" },
          }))
        );
        out.push(new Paragraph({ text: "" }));
        break;
      }
      case "table": {
        const tbl = tok as Tokens.Table;
        const headerRow = new TableRow({
          tableHeader: true,
          children: tbl.header.map((cell) =>
            new TableCell({
              shading: { type: "clear", color: "auto", fill: "E5E7EB" },
              children: [new Paragraph({ children: inlineRuns(cell.tokens as Tokens.Generic[], { bold: true }) })],
            })
          ),
        });
        const bodyRows = tbl.rows.map((row) =>
          new TableRow({
            children: row.map((cell) =>
              new TableCell({
                children: [new Paragraph({ children: inlineRuns(cell.tokens as Tokens.Generic[]) })],
              })
            ),
          })
        );
        out.push(
          // @ts-expect-error docx accepts Table inside section children
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...bodyRows],
          })
        );
        out.push(new Paragraph({ text: "" }));
        break;
      }
      case "hr":
        out.push(new Paragraph({
          border: { bottom: { color: "9CA3AF", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          children: [],
        }));
        break;
      case "space":
        out.push(new Paragraph({ text: "" }));
        break;
      default:
        if ("text" in tok && typeof (tok as { text?: unknown }).text === "string") {
          out.push(new Paragraph({ children: [new TextRun({ text: (tok as { text: string }).text })] }));
        }
    }
  }
  return out;
}

export async function exportConversationDocx(title: string, messages: ExportMsg[]) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Exported on ${new Date().toLocaleString()}`, italics: true, size: 18, color: "666666" })],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const m of messages) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: m.role === "user" ? "You" : "AI Assistant", bold: true, color: m.role === "user" ? "1E40AF" : "374151" })],
      })
    );
    if (m.role === "assistant") {
      // Render markdown for AI responses
      children.push(...tokensToParagraphs(m.content));
    } else {
      // Plain text for user messages
      m.content.split("\n").forEach((line) =>
        children.push(new Paragraph({ children: [new TextRun({ text: line })] }))
      );
    }
    children.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeName(title)}.docx`);
}

// ── Markdown → HTML for PDF ─────────────────────────────────────────────────

export function renderMarkdownHtml(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

// ── Other formats ───────────────────────────────────────────────────────────

export function exportConversationMarkdown(title: string, messages: ExportMsg[]) {
  const md =
    `# ${title}\n\n_Exported on ${new Date().toLocaleString()}_\n\n` +
    messages
      .map((m) => `## ${m.role === "user" ? "You" : "AI Assistant"}\n\n${m.content}\n`)
      .join("\n---\n\n");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  saveAs(blob, `${safeName(title)}.md`);
}

export function exportConversationJson(title: string, messages: ExportMsg[]) {
  const payload = { title, exportedAt: new Date().toISOString(), messages };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  saveAs(blob, `${safeName(title)}.json`);
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

// Structured output directive — appended to user prompts when "structured mode" is on
export const STRUCTURED_DIRECTIVE = `

Please respond using this exact structure with markdown headings:

## Summary
A 2–3 sentence executive summary.

## Key Findings
- Bullet list of the most important findings (data-driven, specific).

## Recommended Actions
1. Numbered, prioritized actions with owner / timeframe where possible.

## Metrics & Evidence
A short markdown table of supporting metrics (columns: Metric | Value | Notes).

## Risks & Caveats
Briefly list assumptions, blind spots, or data gaps.`;

// Advanced AI tool presets — structured prompts the model can act on
export interface AITool {
  id: string;
  label: string;
  category: "Operations" | "Finance" | "Workforce" | "Customer" | "Strategy";
  prompt: string;
}

export const ADVANCED_AI_TOOLS: AITool[] = [
  { id: "exec-brief", label: "Executive Brief", category: "Strategy",
    prompt: "Generate today's executive brief: top 5 KPIs vs last week, biggest wins, biggest risks, and 3 decisions I should make today." },
  { id: "sla-risk", label: "SLA Risk Report", category: "Operations",
    prompt: "Build an SLA risk report: list jobs at risk of breach in the next 24h, root cause for each, and a recommended mitigation." },
  { id: "dispatch-plan", label: "Dispatch Plan", category: "Operations",
    prompt: "Create an optimal dispatch plan for all unassigned jobs. For each job suggest the best engineer with reasoning (skills, distance, workload, rating)." },
  { id: "cash-flow", label: "Cash Flow Forecast", category: "Finance",
    prompt: "Forecast cash flow for the next 30 days using outstanding invoices, recurring billing, and pipeline. Flag liquidity risks." },
  { id: "ar-aging", label: "AR Aging & Collections", category: "Finance",
    prompt: "Produce an AR aging report (0-30, 31-60, 61-90, 90+). Identify top 5 overdue clients and draft collection emails for each." },
  { id: "margin-analysis", label: "Margin Analysis", category: "Finance",
    prompt: "Analyze gross margin by service type, region, and engineer. Identify the 3 lowest-margin segments and propose pricing or cost actions." },
  { id: "workforce-health", label: "Workforce Health Check", category: "Workforce",
    prompt: "Run a workforce health check: utilization, overtime, burnout signals, skill gaps, retention risks. Recommend training & hiring priorities." },
  { id: "engineer-coaching", label: "Engineer Coaching Notes", category: "Workforce",
    prompt: "For my bottom-quartile engineers by performance score, generate personalized coaching notes with specific KPIs to focus on." },
  { id: "client-health", label: "Client Health Scorecard", category: "Customer",
    prompt: "Score each active client on health (volume trend, NPS, payment behavior, SLA adherence). Flag churn risks and upsell opportunities." },
  { id: "csat-themes", label: "CSAT Theme Analysis", category: "Customer",
    prompt: "Analyze recent CSAT and survey responses. Cluster feedback into themes, quantify each, and recommend product/process fixes." },
  { id: "competitive-pricing", label: "Competitive Pricing Review", category: "Strategy",
    prompt: "Review my pricing vs market for top 10 services. Highlight underpriced or overpriced offerings and recommend adjustments with expected revenue impact." },
  { id: "growth-opps", label: "Growth Opportunities", category: "Strategy",
    prompt: "Identify the top 5 growth opportunities (new services, regions, client segments) ranked by estimated revenue and effort." },
];
