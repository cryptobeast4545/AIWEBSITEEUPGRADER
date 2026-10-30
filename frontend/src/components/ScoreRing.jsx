export const scoreColor = (s) => (s == null ? "#6B7280" : s >= 90 ? "#10B981" : s >= 60 ? "#F59E0B" : "#EF4444");

export default function ScoreRing({ score, label, size = 132, testid }) {
  const r = (size - 16) / 2, c = 2 * Math.PI * r, v = score ?? 0;
  return (
    <div className="flex flex-col items-center gap-2" data-testid={testid}>
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score ?? "not available"} out of 100`}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#1F2937" strokeWidth="10" fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={scoreColor(score)} strokeWidth="10" fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display font-extrabold" style={{ fontSize: size / 3.6 }} data-testid={testid ? `${testid}-value` : undefined}>{score ?? "–"}</span>
        </div>
      </div>
      <span className="text-xs font-mono uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}

const IMPACT = {
  critical: "bg-red-950 text-red-200 border-red-800",
  serious: "bg-orange-950 text-orange-200 border-orange-800",
  moderate: "bg-amber-950 text-amber-200 border-amber-800",
  minor: "bg-blue-950 text-blue-200 border-blue-800",
};

export const ImpactBadge = ({ impact }) => (
  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${IMPACT[impact] || IMPACT.minor}`}>{impact}</span>
);

export const ImpactCounts = ({ counts = {} }) => (
  <div className="flex flex-wrap gap-2" data-testid="impact-counts">
    {["critical", "serious", "moderate", "minor"].map((k) => (
      <span key={k} className={`rounded-full border px-3 py-1 text-xs font-bold ${IMPACT[k]}`} data-testid={`count-${k}`}>{counts[k] || 0} {k}</span>
    ))}
  </div>
);
