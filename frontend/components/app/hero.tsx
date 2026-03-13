import Link from "next/link";
import { ArrowRight, Radio, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

const highlights = [
  {
    icon: Radio,
    title: "Go live your way",
    text: "Create a stream in Studio, connect OBS or your encoder, and start broadcasting with a workflow creators already know.",
  },
  {
    icon: Users,
    title: "Built for viewers",
    text: "Bring people straight into the stream with a clean watch page, live chat, and a discovery-first homepage.",
  },
  {
    icon: Sparkles,
    title: "From setup to showtime",
    text: "Keep your channel organized with a dashboard for live sessions, upcoming broadcasts, and quick creator actions.",
  },
];

type HeroProps = {
  liveCount?: number;
};

export function Hero({ liveCount = 0 }: HeroProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
      <Panel className="overflow-hidden border-cyan-400/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(15,23,42,0.25))]">
        <div className="space-y-8">
          <div className="inline-flex rounded-full bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Watch live. Stream faster.
          </div>
          <div className="space-y-4">
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Discover live creators and launch your own stream from one polished platform.
            </h2>
            <p className="max-w-2xl text-base leading-8 text-slate-300">
              Browse what is live right now, jump into the chat, and give creators a studio that feels familiar from day
              one.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/browse">
              <Button>
                Watch live
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/studio">
              <Button variant="secondary">Start streaming</Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live now</p>
              <p className="mt-2 text-3xl font-semibold text-white">{liveCount}</p>
              <p className="mt-1 text-sm text-slate-400">Channels currently live on the platform.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Creator flow</p>
              <p className="mt-2 text-lg font-semibold text-white">{"Studio -> OBS -> Go live"}</p>
              <p className="mt-1 text-sm text-slate-400">A simple setup creators can use in production.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Viewer experience</p>
              <p className="mt-2 text-lg font-semibold text-white">Watch and chat</p>
              <p className="mt-1 text-sm text-slate-400">Clean playback with audience conversation built in.</p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4">
        {highlights.map(({ icon: Icon, title, text }) => (
          <Panel key={title}>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                <Icon size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-white">{title}</h3>
                <p className="text-sm leading-6 text-slate-400">{text}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
