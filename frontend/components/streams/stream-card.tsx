import Link from "next/link";
import { ArrowUpRight, Copy, Radio, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { Session, Stream } from "@/lib/types";
import { deleteStream } from "@/lib/api";

function toneForStatus(status: Stream["status"]) {
  switch (status) {
    case "live":
      return "success";
    case "ended":
      return "warning";
    default:
      return "default";
  }
}

type StreamCardProps = {
  stream: Stream;
  session?: Session | null;
  onDeleted?: (id: string) => void;
};

export function StreamCard({ stream, session, onDeleted }: StreamCardProps) {
  const [copiedField, setCopiedField] = useState<"server" | "key" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function copyValue(value: string, field: "server" | "key") {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500);
  }

  async function handleDelete() {
    if (!session || !onDeleted) return;
    if (!confirm("Delete this stream? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteStream(session, stream.id);
      onDeleted(stream.id);
    } catch {
      setIsDeleting(false);
    }
  }

  const obsServerUrl = stream.rtmp_url.replace(
    new RegExp(`/${stream.stream_key}$`),
    "",
  );

  return (
    <Panel className="h-full">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">{stream.title}</h3>
            <p className="text-sm leading-6 text-slate-400">
              {stream.description || "Add a short description so viewers know what to expect before they join."}
            </p>
          </div>
          <Badge tone={toneForStatus(stream.status)}>
            {stream.status === "live" ? "Live" : stream.status === "ended" ? "Ended" : "Ready"}
          </Badge>
        </div>

        <div className="grid gap-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Server URL (for OBS)</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
                onClick={() => copyValue(obsServerUrl, "server")}
              >
                <Copy size={14} />
                {copiedField === "server" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="break-all font-medium text-white">{obsServerUrl}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Stream key</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
                onClick={() => copyValue(stream.stream_key, "key")}
              >
                <Copy size={14} />
                {copiedField === "key" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="break-all font-medium text-white">{stream.stream_key}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/watch/${stream.id}`}>
            <Button>
              <Radio size={16} />
              Open watch page
            </Button>
          </Link>
          <Link href="/studio">
            <Button variant="secondary">
              <ArrowUpRight size={16} />
              Open studio
            </Button>
          </Link>
          {session && onDeleted && stream.status !== "live" ? (
            <Button variant="secondary" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 size={16} />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
