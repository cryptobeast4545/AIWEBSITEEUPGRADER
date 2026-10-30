import { Link } from "react-router-dom";
import { Show, UserButton } from "@clerk/react";
import { Accessibility } from "lucide-react";

export const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5 group" data-testid="nav-logo">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-[#04130D] transition-transform group-hover:rotate-12">
      <Accessibility className="h-5 w-5" aria-hidden="true" />
    </span>
    <span className="font-display text-lg font-extrabold">AccessLayer</span>
  </Link>
);

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-[#0B0F19]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 md:px-8" aria-label="Main">
        <Logo />
        <div className="flex items-center gap-3 whitespace-nowrap text-sm md:gap-6">
          <a href="/#features" className="hidden md:inline text-slate-300 hover:text-white" data-testid="nav-features">Features</a>
          <a href="/#install" className="hidden md:inline text-slate-300 hover:text-white" data-testid="nav-install">Install</a>
          <Link to="/demo" className="hidden text-slate-300 hover:text-white sm:inline" data-testid="nav-demo">Live demo</Link>
          <Show when="signed-out">
            <Link to="/sign-in" className="text-slate-300 hover:text-white" data-testid="nav-sign-in">Sign in</Link>
            <Link to="/sign-up" className="rounded-full bg-emerald-500 px-4 py-2 font-bold text-[#04130D] transition-colors hover:bg-emerald-400" data-testid="nav-get-started">Get started</Link>
          </Show>
          <Show when="signed-in">
            <Link to="/dashboard" className="rounded-full bg-emerald-500 px-4 py-2 font-bold text-[#04130D] hover:bg-emerald-400" data-testid="nav-dashboard">Dashboard</Link>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}
