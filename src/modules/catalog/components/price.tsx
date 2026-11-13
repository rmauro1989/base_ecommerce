import { formatCLP } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { SaleUnit } from "../pricing";

export function unitSuffix(saleUnit: SaleUnit, packLabel?: string | null) {
  if (saleUnit === "METER") return "por metro";
  if (saleUnit === "PACK") return packLabel ? `por ${packLabel.toLowerCase()}` : "por empaque";
  return null;
}

export function Price({
  amount,
  compareAt,
  saleUnit,
  packLabel,
  fromPrice,
  size = "md",
  className,
}: {
  amount: number;
  compareAt?: number | null;
  saleUnit: SaleUnit;
  packLabel?: string | null;
  fromPrice?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const suffix = unitSuffix(saleUnit, packLabel);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      {fromPrice ? <span className="text-xs text-muted">Desde</span> : null}
      <span className={cn("font-display font-bold", size === "lg" ? "text-3xl" : "text-lg")}>{formatCLP(amount)}</span>
      {compareAt && compareAt > amount ? <s className="text-sm text-muted">{formatCLP(compareAt)}</s> : null}
      {suffix ? <span className="text-xs text-muted">{suffix}</span> : null}
    </div>
  );
}
