import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Loader2 } from "lucide-react";
import Nav from "@/components/Nav";
import ScoreRing, { ImpactCounts } from "@/components/ScoreRing";
import { ViolationList, SeoList } from "@/components/AuditView";
import { API, errMsg } from "@/lib/api";

export default function Report() {
  const { id } = useParams();
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { axios.get(`${API}/reports/${id}`).then((r) => setA(r.data)).catch((e) => setErr(errMsg(e))); }, [id]);
  return (
    <div className="grain min-h-screen">
      <Nav />
      <main id="main" className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        {err && <p className="text-red-300" data-testid="report-error">{err}</p>}
        {!a && !err && <div className="grid h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-label="Loading report" /></div>}
        {a && (
          <div className="space-y-10 fade-up" data-testid="report-page">
            <div>
              <p className="eyebrow">WCAG 2.1 AA audit report</p>
              <h1 className="mt-2 break-all text-3xl font-extrabold md:text-4xl">{a.site_name || a.meta?.title || a.url}</h1>
              <p className="mt-1 break-all text-slate-400">{a.url} · {new Date(a.created_at).toLocaleString()}</p>
            </div>
            <div className="grid gap-6 rounded-3xl border border-border bg-[#111827] p-6 md:grid-cols-[auto_auto_1fr] md:items-center md:gap-10">
              <ScoreRing score={a.a11y_score} label="Accessibility" testid="report-a11y-score" />
              <ScoreRing score={a.seo_score} label="SEO" testid="report-seo-score" />
              <div className="space-y-4">
                <ImpactCounts counts={a.counts} />
                <p className="text-sm text-slate-300">Fix most of these instantly with one line of code — AccessLayer auto-remediates alt text, labels, keyboard access and more.</p>
                <Link to="/sign-up" className="inline-block rounded-full bg-emerald-500 px-5 py-2.5 font-bold text-[#04130D] hover:bg-emerald-400" data-testid="report-cta">Fix my site & get AI fix tips</Link>
              </div>
            </div>
            <section><h2 className="mb-4 text-xl font-bold">Accessibility issues ({a.violations.length})</h2><ViolationList violations={a.violations} fixes={a.fixes || {}} /></section>
            <section><h2 className="mb-4 text-xl font-bold">SEO audit</h2><SeoList checks={a.seo} /></section>
          </div>
        )}
      </main>
    </div>
  );
}
