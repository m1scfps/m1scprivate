interface RatioCardProps {
  ratios: Array<{
    label: string;
    value: number;
  }>;
}

export function RatioCard({ ratios }: RatioCardProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-gradient-card p-6 backdrop-blur-sm">
      <h3 className="mb-4 text-lg font-semibold text-foreground">📊 Conversion Ratios</h3>
      <div className="space-y-2 text-sm">
        {ratios.map((ratio, index) => (
          <p key={index}>
            <span className="text-muted-foreground">{ratio.label}:</span>{" "}
            <span className="font-medium text-foreground">{ratio.value.toFixed(4)}x</span>
          </p>
        ))}
      </div>
    </div>
  );
}
