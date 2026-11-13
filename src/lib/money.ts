const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

/** 12990 → "$12.990" */
export function formatCLP(amount: number): string {
  return clp.format(Math.round(amount));
}

/** 2.5 → "2,5" */
export function formatNumber(n: number): string {
  return num.format(n);
}
