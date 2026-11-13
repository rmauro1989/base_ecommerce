"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORTS, type SortKey } from "../filters";

export function SortSelect({ value }: { value: SortKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Ordenar</span>
      <select
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams(params.toString());
          if (e.target.value === "relevancia") sp.delete("orden");
          else sp.set("orden", e.target.value);
          sp.delete("pagina");
          const qs = sp.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
        className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm"
      >
        {Object.entries(SORTS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
