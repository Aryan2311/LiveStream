type BadgeProps = {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default: "bg-white/8 text-slate-200",
  success: "bg-emerald-400/15 text-emerald-300",
  warning: "bg-amber-400/15 text-amber-300",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] ${tones[tone]}`}>
      {children}
    </span>
  );
}
