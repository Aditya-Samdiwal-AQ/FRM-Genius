import type { HTMLAttributes, ReactNode } from "react";

type SkeletonProps = HTMLAttributes<HTMLSpanElement>;

/** Inline placeholder that pulses while data is loading. */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      role="presentation"
      className={`inline-block animate-pulse rounded bg-[var(--border)] align-middle ${className}`}
      {...props}
    />
  );
}

interface LoadingValueProps {
  /** When true, render the skeleton in place of the value. */
  loading: boolean;
  /** Extra classes for the skeleton box (typically width/height). */
  skeletonClassName?: string;
  /** Accessible label announced to screen readers while loading. */
  loadingLabel?: string;
  children: ReactNode;
}

/**
 * Renders `children` once loaded; renders a `<Skeleton>` while `loading` is true.
 * Prevents flashing a placeholder value (e.g. "0") before data arrives.
 */
export function LoadingValue({
  loading,
  skeletonClassName = "h-4 w-16",
  loadingLabel = "Loading",
  children,
}: LoadingValueProps) {
  if (loading) {
    return (
      <>
        <span className="sr-only">{loadingLabel}</span>
        <Skeleton className={skeletonClassName} />
      </>
    );
  }
  return <>{children}</>;
}
