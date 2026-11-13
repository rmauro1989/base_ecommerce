import { cn } from "@/lib/cn";

export function SearchForm({ className, defaultValue, large }: { className?: string; defaultValue?: string; large?: boolean }) {
  return (
    <form action="/buscar" role="search" className={cn("flex w-full", className)}>
      <label htmlFor={large ? "q-hero" : undefined} className="sr-only">
        Buscar productos
      </label>
      <input
        id={large ? "q-hero" : undefined}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={large ? "Ej: cable 2,5 mm², enchufe exterior, diferencial…" : "Buscar productos, marcas o códigos"}
        className={cn(
          "w-full min-w-0 rounded-l-md border border-r-0 border-border-strong bg-surface px-3 text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-accent",
          large ? "h-14 text-base" : "h-10 text-sm",
        )}
      />
      <button
        type="submit"
        className={cn("shrink-0 rounded-r-md bg-accent px-4 font-semibold text-on-accent hover:brightness-95", large ? "h-14 px-6" : "h-10")}
      >
        Buscar
      </button>
    </form>
  );
}
