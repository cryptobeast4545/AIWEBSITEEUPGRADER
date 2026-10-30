import { Logo } from "@/components/Nav";

export default function AuthShell({ children }) {
  return (
    <div className="grain relative grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-[#111827] p-12 lg:flex">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="relative"><Logo /></div>
        <div className="relative max-w-md">
          <p className="eyebrow mb-4">Site owner console</p>
          <h1 className="text-4xl font-extrabold leading-tight">Make every page usable by everyone.</h1>
          <p className="mt-4 text-slate-300">Scan, auto-fix and monitor WCAG 2.1 AA compliance — with Indic voice control, WhatsApp alerts and email scorecards.</p>
        </div>
        <p className="relative font-mono text-xs text-slate-400">ADA · Section 508 · EAA · GIGW</p>
      </aside>
      <main className="flex items-center justify-center p-6" data-testid="auth-page">{children}</main>
    </div>
  );
}
