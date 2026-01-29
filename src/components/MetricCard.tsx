import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  prefix?: string;
  className?: string;
}

export function MetricCard({ label, value, prefix = "", className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-gradient-card p-4 backdrop-blur-sm",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">
        {prefix}{value}
      </p>
    </div>
  );
}
