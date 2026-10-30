import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Loader2, Play, Mail, MessageCircle, Trash2, ArrowLeft, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Nav from "@/components/Nav";
import ScoreRing, { ImpactCounts, scoreColor } from "@/components/ScoreRing";
import { ViolationList, SeoList } from "@/components/AuditView";
import EmbedSnippet from "@/components/EmbedSnippet";
import { useApi, errMsg, API } from "@/lib/api";

function AuditPanel({ audit, onFix }) {
  if (!audit) return <p className="rounded-3xl border border-dashed border-border p-10 text-center text-slate-400" data-testid="no-audit">No audits yet — click “Run audit”.</p>;
  return (
    <div className="space-y-8">
      <div className="grid gap-5 rounded-3xl border border-border bg-[#111827] p-6 md:grid-cols-[auto_auto_1fr] md:items-center md:gap-10">
        <ScoreRing score={audit.a11y_score} label="Accessibility" testid="a11y-score" />
        <ScoreRing score={audit.seo_score} label="SEO" testid="seo-score" />
        <div className="space-y-3">
          <ImpactCounts counts={audit.counts} />
          <p className="text-sm text-slate-400">{new Date(audit.created_at).toLocaleString()} · <span className="font-mono">{audit.meta?.engine || audit.source}</span></p>
          <p className="truncate text-sm text-slate-300">{audit.url}</p>
          <Link to={`/report/${audit.id}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200" data-testid="public-report-link"><Share2 className="h-4 w-4" /> Shareable report</Link>
        </div>
      </div>
      <section><h2 className="mb-4 text-xl font-bold">Accessibility issues ({audit.violations.length})</h2><ViolationList violations={audit.violations} onFix={onFix} fixes={audit.fixes || {}} /></section>
      <section><h2 className="mb-4 text-xl font-bold">SEO audit</h2><SeoList checks={audit.seo} /></section>
    </div>
  );
}

function Settings({ site, onSave }) {
  const [f, setF] = useState({ whatsapp: site.whatsapp || "", alert_email: site.alert_email || "" });
  const toggle = (k) => (v) => onSave({ [k]: v });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="space-y-4 rounded-3xl border border-border bg-[#111827] p-6" onSubmit={(e) => { e.preventDefault(); onSave(f); }} data-testid="settings-form">
        <h3 className="font-bold">Alert & report channels</h3>
        <div className="space-y-1.5"><Label htmlFor="s-wa">WhatsApp number (India)</Label><Input id="s-wa" className="h-11 bg-[#0B0F19]" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="9876543210" data-testid="settings-whatsapp" /></div>
        <div className="space-y-1.5"><Label htmlFor="s-em">Report email</Label><Input id="s-em" type="email" className="h-11 bg-[#0B0F19]" value={f.alert_email} onChange={(e) => setF({ ...f, alert_email: e.target.value })} placeholder="owner@example.com" data-testid="settings-email" /></div>
        <button className="rounded-full bg-emerald-500 px-5 py-2.5 font-bold text-[#04130D] hover:bg-emerald-400" data-testid="settings-save">Save channels</button>
      </form>
      <div className="space-y-4 rounded-3xl border border-border bg-[#111827] p-6">
        <h3 className="font-bold">Widget behaviour</h3>
        {[["alerts_enabled", "Compliance drop alerts (score falls ≥5 pts)"], ["autofix", "Auto-fix DOM issues on page load"], ["voice_enabled", "Voice control mode (Sarvam AI)"], ["ai_alt", "AI vision alt text for images"]].map(([k, l]) => (
          <div key={k} className="flex items-center justify-between gap-4"><Label htmlFor={`t-${k}`} className="text-sm">{l}</Label><Switch id={`t-${k}`} checked={!!site[k]} onCheckedChange={toggle(k)} data-testid={`toggle-${k}`} /></div>
        ))}
      </div>
      <div className="rounded-3xl border border-border bg-[#111827] p-6 lg:col-span-2">
        <h3 className="font-bold">WhatsApp bot webhook (Fast2SMS)</h3>
        <p className="mt-1 text-sm text-slate-400">Set this URL as the incoming-message webhook in your Fast2SMS WhatsApp dashboard. Owners can then text <b className="text-white">#AUDIT</b>, <b className="text-white">#SITES</b> or ask fix questions.</p>
        <code className="mt-3 block overflow-x-auto rounded-xl bg-black/60 p-3 text-sm text-emerald-200" data-testid="webhook-url">{API}/whatsapp/webhook</code>
      </div>
    </div>
  );
}

function History({ audits, onPick, current }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-[#111827]" data-testid="audit-history">
      {audits.map((a) => (
        <li key={a.id}>
          <button onClick={() => onPick(a.id)} className={`flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/5 ${current === a.id ? "bg-emerald-950/40" : ""}`} data-testid={`history-${a.id}`}>
            <span className="w-12 font-display text-2xl font-extrabold" style={{ color: scoreColor(a.a11y_score) }}>{a.a11y_score}</span>
            <span className="w-20 font-mono text-xs uppercase text-slate-400">{a.source}</span>
            <span className="flex-1 truncate text-sm text-slate-300">{a.url}</span>
            <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
          </button>
        </li>
      ))}
      {!audits.length && <li className="p-6 text-slate-400">No audits yet.</li>}
    </ul>
  );
}

export default function SiteDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const api = useApi();
  const [site, setSite] = useState(null);
  const [audits, setAudits] = useState([]);
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState("");

  const loadAudit = useCallback(async (aid) => setAudit(await api("get", `/audits/${aid}`)), [api]);
  const load = useCallback(async () => {
    const [s, list] = await Promise.all([api("get", `/sites/${id}`), api("get", `/sites/${id}/audits`)]);
    setSite(s); setAudits(list);
    if (list[0]) await loadAudit(list[0].id);
  }, [api, id, loadAudit]);

  const runAudit = useCallback(async () => {
    setBusy("audit");
    try {
      const a = await api("post", `/sites/${id}/audit`);
      setAudit(a); setAudits(await api("get", `/sites/${id}/audits`));
      toast.success(`Audit complete — accessibility ${a.a11y_score}/100, SEO ${a.seo_score}/100`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }, [api, id]);

  useEffect(() => {
    load().then(() => { if (params.get("audit")) { setParams({}); runAudit(); } }).catch((e) => { toast.error(errMsg(e)); nav("/dashboard"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onFix = async (rule_id) => {
    try { const r = await api("post", `/audits/${audit.id}/fix`, { rule_id }); setAudit((a) => ({ ...a, fixes: { ...(a.fixes || {}), [rule_id]: r.tip } })); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const send = async (ch) => {
    if (!audit) return toast.error("Run an audit first");
    setBusy(ch);
    try { const r = await api("post", `/audits/${audit.id}/send-${ch}`); toast.success(`Scorecard sent to ${r.to}`); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };
  const save = async (patch) => {
    try { setSite(await api("patch", `/sites/${id}`, patch)); toast.success("Saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${site.name} and all its audits?`)) return;
    try { await api("delete", `/sites/${id}`); toast.success("Site deleted"); nav("/dashboard"); } catch (e) { toast.error(errMsg(e)); }
  };

  if (!site) return <div className="min-h-screen"><Nav /><div className="grid h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-label="Loading" /></div></div>;
  const Btn = ({ k, icon: I, children, onClick, primary }) => (
    <button onClick={onClick} disabled={!!busy} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60 ${primary ? "bg-emerald-500 text-[#04130D] hover:bg-emerald-400" : "border border-border hover:border-emerald-500"}`} data-testid={`${k}-btn`}>
      {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : <I className="h-4 w-4" />} {children}
    </button>
  );
  return (
    <div className="grain min-h-screen">
      <Nav />
      <main id="main" className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white" data-testid="back-dashboard"><ArrowLeft className="h-4 w-4" /> All sites</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold md:text-4xl" data-testid="site-name">{site.name}</h1>
            <a href={site.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-300">{site.url} <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn k="audit" icon={Play} onClick={runAudit} primary>{busy === "audit" ? "Auditing…" : "Run audit"}</Btn>
            <Btn k="email" icon={Mail} onClick={() => send("email")}>Email scorecard</Btn>
            <Btn k="whatsapp" icon={MessageCircle} onClick={() => send("whatsapp")}>WhatsApp scorecard</Btn>
          </div>
        </div>
        <Tabs defaultValue="overview" className="mt-8">
          <TabsList className="h-auto flex-wrap bg-[#111827] p-1">
            {["overview", "install", "history", "settings"].map((t) => <TabsTrigger key={t} value={t} className="capitalize data-[state=active]:bg-emerald-500 data-[state=active]:text-[#04130D]" data-testid={`tab-${t}`}>{t}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="overview" className="mt-6"><AuditPanel audit={audit} onFix={onFix} /></TabsContent>
          <TabsContent value="install" className="mt-6 space-y-4">
            <p className="text-slate-300">Paste this into the <code className="text-emerald-300">&lt;head&gt;</code> of every page. In-browser axe-core scans from visitors will appear in History as <span className="font-mono">widget</span> audits.</p>
            <EmbedSnippet siteId={site.id} />
            <p className="text-sm text-slate-400">Options: <code>data-autofix="false"</code> disables DOM fixes · <code>data-sarvam-voice="disabled"</code> uses browser voice · <code>data-position="left"</code> moves the button. Visitors open the menu with <b>Alt + A</b>.</p>
          </TabsContent>
          <TabsContent value="history" className="mt-6"><History audits={audits} onPick={loadAudit} current={audit?.id} /></TabsContent>
          <TabsContent value="settings" className="mt-6 space-y-6">
            <Settings site={site} onSave={save} />
            <button onClick={remove} className="inline-flex items-center gap-2 rounded-full border border-red-800 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-950" data-testid="delete-site-btn"><Trash2 className="h-4 w-4" /> Delete site</button>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
