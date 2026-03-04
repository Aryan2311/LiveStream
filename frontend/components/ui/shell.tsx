import Link from "next/link";

type ShellProps = {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function Shell({ children, eyebrow, title, description, actions }: ShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(68,211,255,0.16),_transparent_35%),linear-gradient(180deg,_#07111f_0%,_#04070d_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-8">
        <header className="mb-10 flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Link href="/" className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">
              LiveNow
            </Link>
            {eyebrow ? <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p> : null}
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{description}</p>
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
