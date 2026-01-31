import type { PremiumInfo } from "@/lib/futuresConverter";

interface PremiumCardProps {
  title: string;
  formula: string;
  premium: PremiumInfo;
  variant?: "nasdaq" | "sp500" | "gold";
}

export function PremiumCard({ title, formula, premium, variant = "nasdaq" }: PremiumCardProps) {
  const isSP500 = variant === "sp500";
  const isGold = variant === "gold";
  
  return (
    <div className={`rounded-xl border p-6 backdrop-blur-sm ${
      isGold
        ? "border-gold/30 bg-gradient-premium-gold"
        : isSP500 
        ? "border-sp-red/30 bg-gradient-premium-sp500" 
        : "border-primary/30 bg-gradient-premium"
    }`}>
      <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Formula:</span>{" "}
          <code className="rounded bg-secondary/50 px-2 py-1 text-primary">{formula}</code>
        </p>
        <p>
          <span className="text-muted-foreground">Theoretical:</span>{" "}
          <span className="font-medium text-foreground">{premium.theoretical.toLocaleString()}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Actual:</span>{" "}
          <span className="font-medium text-foreground">{premium.actual.toLocaleString()}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Premium Points:</span>{" "}
          <span className="font-medium text-foreground">{premium.points.toFixed(2)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Premium %:</span>{" "}
          <span className="font-medium text-foreground">{premium.percent.toFixed(4)}%</span>
        </p>
        <p>
          <span className="text-muted-foreground">$ per contract:</span>{" "}
          <span className="font-semibold text-success">${premium.dollars.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}
