import { Copy } from "lucide-react";
import { toast } from "sonner";
import { embedSnippet } from "@/lib/api";

export default function EmbedSnippet({ siteId }) {
  const code = embedSnippet(siteId);
  const copy = async () => { await navigator.clipboard.writeText(code); toast.success("Embed code copied"); };
  return (
    <div className="relative rounded-2xl border border-border bg-black/60" data-testid="embed-snippet">
      <button onClick={copy} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-[#111827] px-3 py-1.5 text-xs font-semibold hover:border-emerald-500" data-testid="copy-embed-btn">
        <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
      </button>
      <pre className="overflow-x-auto p-5 pr-24 text-xs leading-relaxed text-emerald-200 md:text-sm"><code>{code}</code></pre>
    </div>
  );
}
