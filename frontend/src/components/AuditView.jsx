import { useState } from "react";
import { ChevronDown, Sparkles, ExternalLink, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { ImpactBadge } from "@/components/ScoreRing";

function Tip({ text }) {
  const parts = text.split(/```(?:html|css|js)?\n?/);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-slate-200" data-testid="fix-tip">
      {parts.map((p, i) => i % 2 ? <pre key={i} className="overflow-x-auto rounded-lg bg-black/60 p-3 text-xs text-emerald-200">{p.trim()}</pre>
        : <p key={i} className="whitespace-pre-wrap leading-relaxed">{p.replace(/\*\*/g, "").trim()}</p>)}
    </div>
  );
}

function ViolationRow({ v, onFix, tip }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fix = async () => { setBusy(true); try { await onFix(v.id); } finally { setBusy(false); } };
  return (
    <li className="rounded-2xl border border-border bg-[#111827] transition-colors hover:border-slate-500" data-testid={`violation-${v.id}`}>
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`violation-toggle-${v.id}`}>
        <ImpactBadge impact={v.impact} />
        <span className="flex-1 font-semibold">{v.help}</span>
        <span className="font-mono text-xs text-slate-400">{v.count ? `${v.count} el.` : "page"}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 text-sm">
          <p className="text-slate-300">{v.description}</p>
          <p className="mt-2 font-mono text-xs text-slate-400">rule: {v.id} · {(v.tags || []).slice(0, 4).join(" · ")}</p>
          {v.nodes?.length > 0 && <div className="mt-3 space-y-1.5">{v.nodes.map((n, i) => <code key={i} className="block overflow-x-auto rounded-lg bg-black/50 px-3 py-2 text-xs text-orange-200">{n.html}</code>)}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            {onFix && !tip && (
              <button onClick={fix} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-[#04130D] hover:bg-emerald-400 disabled:opacity-60" data-testid={`ai-fix-btn-${v.id}`}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {busy ? "Asking Gemini…" : "AI fix suggestion"}
              </button>
            )}
            {v.helpUrl && <a href={v.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-slate-400">Rule docs <ExternalLink className="h-3 w-3" /></a>}
          </div>
          {tip && <Tip text={tip} />}
        </div>
      )}
    </li>
  );
}

export function ViolationList({ violations = [], onFix, fixes = {} }) {
  if (!violations.length) return <p className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-6 text-emerald-200" data-testid="no-violations">No accessibility violations detected. Great work!</p>;
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  return <ul className="space-y-3" data-testid="violation-list">{[...violations].sort((a, b) => order[a.impact] - order[b.impact]).map((v) => <ViolationRow key={v.id} v={v} onFix={onFix} tip={fixes[v.id]} />)}</ul>;
}

const ICON = { pass: <CheckCircle2 className="h-5 w-5 text-emerald-400" />, warn: <AlertTriangle className="h-5 w-5 text-amber-400" />, fail: <XCircle className="h-5 w-5 text-red-400" /> };

export function SeoList({ checks = [] }) {
  if (!checks.length) return <p className="text-slate-400" data-testid="seo-empty">SEO checks run with URL audits (not in-browser widget scans).</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="seo-list">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-3 rounded-2xl border border-border bg-[#111827] p-4" data-testid={`seo-${c.id}`}>
          <span aria-label={c.status}>{ICON[c.status]}</span>
          <div className="min-w-0"><p className="font-semibold">{c.title}</p><p className="truncate text-sm text-slate-400">{c.detail}</p></div>
        </li>
      ))}
    </ul>
  );
}
