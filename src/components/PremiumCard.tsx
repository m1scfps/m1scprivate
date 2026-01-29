import type { PremiumInfo } from "@/lib/futuresConverter";

interface PremiumCardProps {
  title: string;
  formula: string;
  premium: PremiumInfo;
}

export function PremiumCard({ title, formula, premium }: PremiumCardProps) {
  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-premium p-6 backdrop-blur-sm">
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
