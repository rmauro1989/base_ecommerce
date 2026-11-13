import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-bg text-muted border border-border",
  primary: "bg-primary text-on-primary",
  accent: "bg-accent text-on-accent",
  soft: "bg-primary-soft text-text",
  success: "bg-surface text-success border border-success",
  danger: "bg-surface text-danger border border-danger",
} as const;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
