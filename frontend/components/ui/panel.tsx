import type { ReactNode } from "react";

type PanelProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, description, action, children, className = "" }: PanelProps) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-slate-950/65 p-6 shadow-xl shadow-black/20 backdrop-blur ${className}`.trim()}>
      {title || description || action ? (
        <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-xl font-semibold text-white">{title}</h2> : null}
            {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
