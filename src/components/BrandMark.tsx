import { cn } from "@/lib/utils";

/** Logo-Kachel: ein „P" in der Display-Schrift auf Primärfarbe. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 select-none items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      P
    </div>
  );
}
