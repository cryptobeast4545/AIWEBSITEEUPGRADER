import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ScanSearch, ImageIcon, Keyboard, Contrast, Mic, MessageCircle, Mail, Search, Loader2, Eye, Hand, Brain, Languages } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import Nav from "@/components/Nav";
import ScoreRing from "@/components/ScoreRing";
import { API, errMsg, embedSnippet } from "@/lib/api";
import { useWidget } from "@/lib/useWidget";

function QuickScan() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const go = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await axios.post(`${API}/public/scan`, { url }); nav(`/report/${data.id}`); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border border-border bg-[#111827]/80 p-2 backdrop-blur sm:flex-row" data-testid="quick-scan-form">
      <label htmlFor="scan-url" className="sr-only">Website URL to scan</label>
      <input id="scan-url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourwebsite.com" className="h-12 flex-1 rounded-xl bg-transparent px-4 text-base outline-none placeholder:text-slate-500" data-testid="quick-scan-input" />
      <button disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 font-bold text-[#04130D] transition-colors hover:bg-emerald-400 disabled:opacity-70" data-testid="quick-scan-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} {busy ? "Auditing…" : "Free audit"}
      </button>
    </form>
  );
}

function HeroVisual() {
  const rows = [["High contrast", true], ["Dyslexia font", true], ["Focus highlight", false], ["Read aloud · हिन्दी", true]];
  return (
    <div className="relative fade-up" style={{ animationDelay: ".2s" }} aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2rem] bg-emerald-500/10 blur-3xl" />
      <div className="relative grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-3xl border border-border bg-[#111827] p-6">
          <p className="eyebrow">Live remediation</p>
          <div className="mt-4 space-y-2.5 font-mono text-[13px]">
            <p className="text-red-300 line-through opacity-70">&lt;img src="IMG_0023.jpg"&gt;</p>
            <p className="text-emerald-300">&lt;img alt="Box of saffron kaju katli on a silver tray"&gt;</p>
            <p className="text-red-300 line-through opacity-70">&lt;div onclick="buy()"&gt;Buy&lt;/div&gt;</p>
            <p className="text-emerald-300">&lt;div role="button" tabindex="0"&gt;Buy&lt;/div&gt;</p>
            <p className="text-red-300 line-through opacity-70">&lt;input placeholder="Phone"&gt;</p>
            <p className="text-emerald-300">&lt;input aria-label="Phone"&gt;</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-[#111827] p-6">
          <ScoreRing score={97} label="After" size={120} />
          <span className="font-mono text-xs text-red-300">before: 41</span>
        </div>
        <div className="rounded-3xl border border-border bg-[#0B0F19] p-5 sm:col-span-2">
          <div className="grid grid-cols-2 gap-2">
            {rows.map(([t, on]) => <div key={t} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${on ? "border-emerald-500 bg-emerald-950" : "border-border"}`}>{t}</div>)}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-[#04130D]"><Mic className="h-4 w-4" /> “संपर्क बटन दबाओ” <span className="ml-auto text-xs font-mono">→ CLICK #contact</span></div>
        </div>
      </div>
    </div>
  );
}

const STATS = [["96.3%", "of top 1M homepages fail WCAG"], ["1B+", "disabled people excluded online"], ["1 line", "drop-in script install"], ["11", "Indic languages via Sarvam AI"]];
const PROBLEMS = [
  [ImageIcon, "Missing image alt text", "Screen readers read IMG_0023.jpg — or skip the image entirely."],
  [Contrast, "Poor colour contrast", "Low-vision and elderly users can't read text on bright mobile screens."],
  [Keyboard, "Inaccessible navigation & forms", "Div-buttons, unlabeled inputs and focus traps block keyboard users."],
  [Languages, "Literacy & language barriers", "English-only interfaces lock out regional and low-literacy citizens."],
];
const FEATURES = [
  [ImageIcon, "AI vision alt text", "Gemini describes unlabeled images and injects meaningful alt text in real time.", "md:col-span-2"],
  [Keyboard, "Keyboard & focus remediation", "Skip links, focus rings, keyboard-operable custom controls, dialog focus traps.", ""],
  [Contrast, "Contrast & dyslexia modes", "High contrast, dark, mono, OpenDyslexic, WCAG 1.4.12 spacing, reading guide.", ""],
  [Mic, "Sarvam Indic voice control", "Speak in Hindi, Tamil, Telugu, Hinglish… Saaras STT + Bulbul TTS drive clicks, scrolls, forms and read-aloud.", "md:col-span-2"],
  [MessageCircle, "WhatsApp fix concierge", "Text #AUDIT for an instant scorecard. Get drop alerts and AI fix help on WhatsApp.", ""],
  [Mail, "Email scorecards", "Rich HTML WCAG scorecards delivered to owners and engineering teams.", ""],
  [Search, "SEO audit built-in", "19 SEO checks — titles, meta, Open Graph, canonical, sitemap, speed — next to your a11y score.", ""],
];
const FIXES = [
  ["Missing form labels", "Blind & screen-reader users", "Associates labels or generates aria-label from placeholder/name"],
  ["Unfocused modals", "Keyboard & motor-impaired", "Adds role=dialog + traps Tab focus until closed"],
  ["Low contrast text", "Low-vision & elderly", "High-contrast theme overlays meeting 4.5:1"],
  ["Crowded typography", "Dyslexic users", "OpenDyslexic / Atkinson fonts + 30%+ spacing"],
  ["Icon-only buttons", "Screen-reader users", "Derives accessible names from icons & links"],
];
const PENALTY = [["Critical", "−25", "Missing form labels, inaccessible modals, zoom disabled", "WhatsApp alert + email"], ["Serious", "−12", "Missing lang, low contrast, empty links", "WhatsApp alert + email"], ["Moderate", "−5", "Heading order, missing main landmark", "Email scorecard"], ["Minor", "−2", "Duplicate IDs, vague link text", "Dashboard summary"]];

export default function Landing() {
  useWidget("demo");
  return (
    <div className="grain relative min-h-screen overflow-x-hidden">
      <Nav />
      <main id="main">
        <section className="relative">
          <div className="grid-bg absolute inset-0 -z-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
            <div className="fade-up">
              <p className="eyebrow flex items-center gap-2"><span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400" /> Universal Accessibility Layer · WCAG 2.1 AA</p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">One line of code.<br /><span className="text-emerald-400">Every visitor included.</span></h1>
              <p className="mt-6 max-w-xl text-base text-slate-300 md:text-lg">AccessLayer scans any website with axe-core, auto-fixes alt text, labels, contrast and keyboard traps, and gives visitors dyslexia modes and Indic voice control — while owners get one-click scorecards on WhatsApp and email.</p>
              <QuickScan />
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <Link to="/demo" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-semibold hover:border-emerald-500" data-testid="hero-demo-btn">See the widget live <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/sign-up" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-emerald-300 hover:text-emerald-200" data-testid="hero-signup-btn">Create owner account →</Link>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section className="border-y border-border bg-[#111827]/60" aria-label="Key numbers">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px md:grid-cols-4">
            {STATS.map(([n, t]) => <div key={n} className="px-6 py-8 md:px-8"><p className="font-display text-3xl font-extrabold text-emerald-400 md:text-4xl">{n}</p><p className="mt-1 text-sm text-slate-300">{t}</p></div>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 md:px-8" aria-labelledby="problems">
          <p className="eyebrow">The problem</p>
          <h2 id="problems" className="mt-3 max-w-2xl text-3xl font-extrabold md:text-4xl">The web is still built for a narrow slice of people.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {PROBLEMS.map(([I, t, d], i) => (
              <div key={t} className="flex gap-5 rounded-3xl border border-border bg-[#111827] p-7 transition-colors hover:border-slate-500">
                <span className="font-mono text-sm text-slate-500">0{i + 1}</span>
                <div><I className="h-6 w-6 text-orange-400" aria-hidden="true" /><h3 className="mt-3 text-lg font-bold">{t}</h3><p className="mt-1.5 text-slate-300">{d}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[[Eye, "Users with disabilities", "Blind, low-vision, motor-impaired, dyslexic and non-native speakers."], [Hand, "Small & medium businesses", "Instant ADA, Section 508 & EAA compliance without engineering overhauls."], [Brain, "Public service portals", "Government, healthcare & education portals with multilingual voice help."]].map(([I, t, d]) => (
              <div key={t} className="rounded-3xl bg-emerald-950/40 p-7 ring-1 ring-emerald-900"><I className="h-6 w-6 text-emerald-400" aria-hidden="true" /><h3 className="mt-3 font-bold">{t}</h3><p className="mt-1 text-sm text-slate-300">{d}</p></div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 pb-24 md:px-8" aria-labelledby="feat-h">
          <p className="eyebrow">How we fix it</p>
          <h2 id="feat-h" className="mt-3 max-w-2xl text-3xl font-extrabold md:text-4xl">A Shadow-DOM engine that repairs pages as they load.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {FEATURES.map(([I, t, d, span]) => (
              <div key={t} className={`group rounded-3xl border border-border bg-[#111827] p-7 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-emerald-600 ${span}`} data-testid={`feature-${t.split(" ")[0].toLowerCase()}`}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400"><I className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-5 text-lg font-bold">{t}</h3><p className="mt-2 text-slate-300">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8" aria-labelledby="fix-h">
          <h2 id="fix-h" className="text-2xl font-extrabold md:text-3xl">Problem vs. automated fix</h2>
          <div className="mt-8 overflow-x-auto rounded-3xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#111827] font-mono text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-4">Barrier</th><th className="p-4">Impacted users</th><th className="p-4">Fix applied by widget</th></tr></thead>
              <tbody>{FIXES.map((r) => <tr key={r[0]} className="border-t border-border"><td className="p-4 font-semibold">{r[0]}</td><td className="p-4 text-slate-300">{r[1]}</td><td className="p-4 text-emerald-300">{r[2]}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section id="install" className="border-y border-border bg-[#111827]/60" aria-labelledby="install-h">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:px-8 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Install</p>
              <h2 id="install-h" className="mt-3 text-3xl font-extrabold md:text-4xl">Paste one script tag. Done.</h2>
              <p className="mt-4 text-slate-300">Works with WordPress, Shopify, Wix, React, plain HTML — any site. The widget loads async inside an isolated Shadow DOM so it never breaks your styles.</p>
              <ol className="mt-6 space-y-3 text-slate-300">
                <li><b className="text-white">1.</b> Create an owner account and add your website.</li>
                <li><b className="text-white">2.</b> Copy your personal snippet into the &lt;head&gt;.</li>
                <li><b className="text-white">3.</b> Watch scores, alerts and scorecards roll in.</li>
              </ol>
            </div>
            <pre className="overflow-x-auto rounded-3xl border border-border bg-black/60 p-6 text-sm leading-relaxed text-emerald-200" data-testid="landing-snippet"><code>{embedSnippet("YOUR_SITE_ID")}</code></pre>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 md:px-8" aria-labelledby="score-h">
          <p className="eyebrow">Scoring engine</p>
          <h2 id="score-h" className="mt-3 text-3xl font-extrabold md:text-4xl">One-click WCAG 2.1 AA score + SEO health</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {PENALTY.map(([k, p, ex, ch]) => (
              <div key={k} className="rounded-3xl border border-border bg-[#111827] p-6">
                <div className="flex items-baseline justify-between"><span className="font-bold">{k}</span><span className="font-display text-2xl font-extrabold text-orange-300">{p}</span></div>
                <p className="mt-3 text-sm text-slate-300">{ex}</p><p className="mt-4 font-mono text-xs text-emerald-300">{ch}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-emerald-500 p-10 text-[#04130D] md:p-14">
            <h2 className="max-w-2xl text-3xl font-extrabold md:text-4xl">Make your site usable by everyone — starting today.</h2>
            <p className="mt-3 max-w-xl font-semibold">Free audit, instant embed code, WhatsApp & email monitoring.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/sign-up" className="rounded-full bg-[#0B0F19] px-6 py-3 font-bold text-white hover:bg-black" data-testid="cta-signup-btn">Start free</Link>
              <Link to="/demo" className="rounded-full border-2 border-[#0B0F19] px-6 py-3 font-bold hover:bg-[#0B0F19]/10" data-testid="cta-demo-btn">Try the demo store</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-slate-400">© {new Date().getFullYear()} AccessLayer · Built with axe-core, Gemini, Sarvam AI, Fast2SMS & Resend</footer>
    </div>
  );
}
