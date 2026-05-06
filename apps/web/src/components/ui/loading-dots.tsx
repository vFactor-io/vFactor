import { cn } from "~/lib/utils";

interface LoadingDotsProps {
  className?: string;
  variant?: "loading" | "attention" | "connecting";
}

const rippleOrder = [2, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 2];
const dotIndices = Array.from({ length: 16 }, (_, index) => `dot-${index}`);
const squareDots = new Set([0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]);

export function LoadingDots({ className, variant = "loading" }: LoadingDotsProps) {
  const isAttention = variant === "attention";
  const isConnecting = variant === "connecting";

  return (
    <span
      aria-hidden="true"
      className={cn("grid size-3.5 shrink-0 grid-cols-4 grid-rows-4 gap-0.5", className)}
    >
      {dotIndices.map((dotKey, index) => {
        const animationOrder = rippleOrder[index] ?? 0;
        const isVisible = isAttention ? squareDots.has(index) : true;
        return (
          <span
            key={dotKey}
            className="size-0.5 rounded-full bg-current"
            style={{
              opacity: isVisible ? undefined : 0,
              animationName: isVisible
                ? isAttention
                  ? "dot-attention"
                  : isConnecting
                    ? "dot-connect"
                    : "dot-pulse"
                : "none",
              animationDuration: isVisible
                ? isAttention
                  ? "600ms"
                  : isConnecting
                    ? "1600ms"
                    : "700ms"
                : undefined,
              animationTimingFunction: isVisible
                ? isAttention
                  ? "ease-in-out"
                  : isConnecting
                    ? "ease-in-out"
                    : "cubic-bezier(0.36, 0, 0.66, 1)"
                : undefined,
              animationIterationCount: isVisible ? "infinite" : undefined,
              animationDelay: isAttention
                ? "0ms"
                : `${animationOrder * (isConnecting ? 90 : 60)}ms`,
            }}
          />
        );
      })}
    </span>
  );
}
