import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi, errMsg } from "@/lib/api";

const F = ({ id, label, ...p }) => (
  <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} data-testid={`add-site-${id}`} className="h-11 bg-[#0B0F19]" {...p} /></div>
);

export default function AddSiteDialog() {
  const api = useApi();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", url: "", whatsapp: "", alert_email: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const s = await api("post", "/sites", f);
      toast.success("Site added — running first audit");
      nav(`/sites/${s.id}?audit=1`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 font-bold text-[#04130D] hover:bg-emerald-400" data-testid="add-site-btn"><Plus className="h-4 w-4" /> Add website</button>
      </DialogTrigger>
      <DialogContent className="border-border bg-[#111827]">
        <DialogHeader><DialogTitle className="font-display">Add a website</DialogTitle><DialogDescription>We'll generate your embed code and run a first WCAG + SEO audit.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4" data-testid="add-site-form">
          <F id="name" label="Site name" required value={f.name} onChange={set("name")} placeholder="Sharma Sweets" />
          <F id="url" label="Website URL" required value={f.url} onChange={set("url")} placeholder="https://example.com" />
          <F id="whatsapp" label="WhatsApp number for alerts (optional)" value={f.whatsapp} onChange={set("whatsapp")} placeholder="98765 43210" inputMode="tel" />
          <F id="alert_email" label="Report email (optional)" type="email" value={f.alert_email} onChange={set("alert_email")} placeholder="owner@example.com" />
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-3 font-bold text-[#04130D] hover:bg-emerald-400 disabled:opacity-60" data-testid="add-site-submit">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add & audit
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
