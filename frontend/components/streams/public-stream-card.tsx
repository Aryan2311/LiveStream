"use client";

import Link from "next/link";
import { ArrowUpRight, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { PublicStream } from "@/lib/types";

function toneForStatus(status: PublicStream["status"]) {
  switch (status) {
    case "live":
      return "success";
    case "ended":
      return "warning";
    default:
      return "default";
  }
}

function labelForStatus(status: PublicStream["status"]) {
  switch (status) {
    case "live":
      return "Live";
    case "ended":
      return "Ended";
    default:
      return "Preparing";
  }
}

export function PublicStreamCard({ stream }: { stream: PublicStream }) {
  return (
    <Panel className="h-full">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">{stream.title}</h3>
            <p className="text-sm leading-6 text-slate-400">
              {stream.description || "This creator is live now. Join the stream and follow along in chat."}
            </p>
          </div>
          <Badge tone={toneForStatus(stream.status)}>{labelForStatus(stream.status)}</Badge>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="mb-1 text-xs uppercase tracking-[0.24em] text-slate-500">Started</p>
          <p className="text-sm text-white">
            {new Date(stream.updated_at || stream.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/watch/${stream.id}`}>
            <Button>
              <Radio size={16} />
              Watch stream
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary">
              <ArrowUpRight size={16} />
              Start your channel
            </Button>
          </Link>
        </div>
      </div>
    </Panel>
  );
}
