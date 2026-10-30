import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Activity, ShieldAlert, Gauge, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import Nav from "@/components/Nav";
import AddSiteDialog from "@/components/AddSiteDialog";
import { scoreColor } from "@/components/ScoreRing";
import { useApi, errMsg } from "@/lib/api";

const Stat = ({ icon: I, label, value, testid }) => (
  <div className="rounded-3xl border border-border bg-[#111827] p-6" data-testid={testid}>
    <I className="h-5 w-5 text-emerald-400" aria-hidden="true" />
    <p className="mt-4 font-display text-3xl font-extrabold">{value}</p>
    <p className="text-sm text-slate-400">{label}</p>
  </div>
);

function SiteCard({ s }) {
  return (
    <Link to={`/sites/${s.id}`} className="group flex flex-col rounded-3xl border border-border bg-[#111827] p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-emerald-600" data-testid={`site-card-${s.id}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0"><h3 className="truncate text-lg font-bold">{s.name}</h3><p className="truncate text-sm text-slate-400">{s.url}</p></div>
        <ArrowUpRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400" aria-hidden="true" />
      </div>
      <div className="mt-6 flex items-end gap-6">
        <div><p className="font-display text-4xl font-extrabold" style={{ color: scoreColor(s.last_score) }}>{s.last_score ?? "–"}</p><p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Accessibility</p></div>
        <div><p className="font-display text-2xl font-extrabold" style={{ color: scoreColor(s.last_seo) }}>{s.last_seo ?? "–"}</p><p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">SEO</p></div>
        <p className="ml-auto text-xs text-slate-400">{s.audit_count} audits</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const api = useApi();
  const [sites, setSites] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    Promise.all([api("get", "/sites"), api("get", "/stats/overview")])
      .then(([s, o]) => { setSites(s); setStats(o); })
      .catch((e) => { toast.error(errMsg(e)); setSites([]); });
  }, [api]);
  const trend = (stats?.trend || []).map((t, i) => ({ n: i + 1, a11y: t.a11y_score, seo: t.seo_score }));
  return (
    <div className="grain min-h-screen">
      <Nav />
      <main id="main" className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Owner console</p><h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Your websites</h1></div>
          <AddSiteDialog />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={Globe} label="Sites monitored" value={stats?.sites ?? "–"} testid="stat-sites" />
          <Stat icon={Activity} label="Audits run" value={stats?.audits ?? "–"} testid="stat-audits" />
          <Stat icon={Gauge} label="Average a11y score" value={stats?.avg_score ?? "–"} testid="stat-avg" />
          <Stat icon={ShieldAlert} label="Open critical issues" value={stats?.open_critical ?? "–"} testid="stat-critical" />
        </div>
        {trend.length > 1 && (
          <div className="mt-6 rounded-3xl border border-border bg-[#111827] p-6" data-testid="trend-chart">
            <p className="mb-4 font-semibold">Score trend (last {trend.length} audits)</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trend}>
                <XAxis dataKey="n" stroke="#6B7280" fontSize={12} /><YAxis domain={[0, 100]} stroke="#6B7280" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0B0F19", border: "1px solid #374151", borderRadius: 12 }} />
                <Area type="monotone" dataKey="a11y" name="Accessibility" stroke="#10B981" fill="#10B98133" strokeWidth={2} />
                <Area type="monotone" dataKey="seo" name="SEO" stroke="#60A5FA" fill="#60A5FA22" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="site-list">
          {sites === null && [1, 2, 3].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-[#111827]" />)}
          {sites?.map((s) => <SiteCard key={s.id} s={s} />)}
          {sites?.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center md:col-span-2 lg:col-span-3" data-testid="empty-sites">
              <p className="text-lg font-bold">No websites yet</p>
              <p className="mt-1 text-slate-400">Add your first site to get its embed code and a WCAG + SEO audit.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
