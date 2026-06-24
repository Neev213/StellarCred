// Status shown with a dot + text. Neutral by default; semantic variants for
// verified / pending / denied.

type Variant = "neutral" | "verified" | "pending" | "denied";

export function Badge({
  variant = "neutral",
  children,
  dot = true,
}: {
  variant?: Variant;
  children: React.ReactNode;
  dot?: boolean;
}) {
  const cls = variant === "neutral" ? "badge" : `badge badge-${variant}`;
  return (
    <span className={cls}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
