import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
};

const baseStyles =
  "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
  secondary: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
  ghost: "text-slate-300 hover:bg-white/8 hover:text-white",
  danger: "bg-rose-500/90 text-white hover:bg-rose-400",
};

export function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
