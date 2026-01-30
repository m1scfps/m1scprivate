import { Star } from "lucide-react";

interface CheatSheetRow {
  concept: string;
  ndxRating: number;
  qqqRating: number;
  why: string;
}

const cheatSheetData: CheatSheetRow[] = [
  { concept: "GEX (gamma exposure)", ndxRating: 5, qqqRating: 2, why: "NDX = the real hedging book" },
  { concept: "Vol Trigger", ndxRating: 5, qqqRating: 1, why: "QQQ has weaker signals" },
  { concept: "Zero Gamma", ndxRating: 5, qqqRating: 3, why: "NDX controls regime" },
  { concept: "Max Pain", ndxRating: 3, qqqRating: 5, why: "Both matter near EOD" },
  { concept: "0DTE pressures", ndxRating: 2, qqqRating: 5, why: "QQQ = retail + HFT" },
  { concept: "Call/Put walls", ndxRating: 3, qqqRating: 4, why: "QQQ walls cause sweeps" },
  { concept: "Liquidity traps", ndxRating: 3, qqqRating: 5, why: "Intraday = QQQ-driven" },
  { concept: "Dealer hedging flips", ndxRating: 5, qqqRating: 3, why: "NDX sets main exposure" },
  { concept: "Intraday sweep zones", ndxRating: 2, qqqRating: 5, why: "QQQ rules sweeps" },
  { concept: "Trend vs Chop prediction", ndxRating: 5, qqqRating: 1, why: "NDX gamma decides this" },
];

function StarRating({ rating, maxRating = 5 }: { rating: number; maxRating?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxRating }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? "fill-warning text-warning" : "fill-muted/30 text-muted/30"
          }`}
        />
      ))}
    </div>
  );
}

export function CheatSheetTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border/50 bg-gradient-card p-6 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <span className="text-xl">📋</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">NDX vs QQQ Cheat Sheet</h2>
        </div>
        <p className="text-muted-foreground">When to use NDX vs QQQ for options flow analysis</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/50 bg-gradient-card backdrop-blur-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Concept</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-muted-foreground">Use NDX?</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-muted-foreground">Use QQQ?</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Why</th>
            </tr>
          </thead>
          <tbody>
            {cheatSheetData.map((row, index) => (
              <tr
                key={row.concept}
                className={`border-b border-border/30 transition-colors hover:bg-secondary/20 ${
                  index % 2 === 0 ? "bg-secondary/5" : ""
                }`}
              >
                <td className="px-6 py-4 font-medium text-foreground">{row.concept}</td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <StarRating rating={row.ndxRating} />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <StarRating rating={row.qqqRating} />
                  </div>
                </td>
                <td className="px-6 py-4 text-primary">{row.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Summary */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-6 backdrop-blur-sm">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Summary</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-semibold text-primary">• NDX:</span>{" "}
            <span className="text-muted-foreground">Best for regime analysis, dealer hedging, gamma exposure</span>
          </li>
          <li>
            <span className="font-semibold text-warning">• QQQ:</span>{" "}
            <span className="text-muted-foreground">Best for intraday sweeps, 0DTE pressure, liquidity traps</span>
          </li>
          <li>
            <span className="font-semibold text-success">• Both:</span>{" "}
            <span className="text-muted-foreground">Max pain matters for both near EOD</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
