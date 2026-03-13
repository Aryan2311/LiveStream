"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchPublicStreams } from "@/lib/api";
import { ApiError, type PublicStream } from "@/lib/types";
import { Panel } from "@/components/ui/panel";
import { PublicStreamCard } from "@/components/streams/public-stream-card";

export function BrowseContent() {
  const [streams, setStreams] = useState<PublicStream[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPublicStreams()
      .then((payload) => {
        if (!cancelled) {
          setStreams(payload);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Unable to load live streams right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const liveStreams = useMemo(
    () => (streams || []).filter((stream) => stream.status === "live"),
    [streams],
  );

  if (streams === null && !error) {
    return (
      <Panel title="Loading streams" description="Finding live channels for viewers right now.">
        <p className="text-sm text-slate-400">Pulling the latest live broadcasts.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Live now"
        description="Discover streams that are currently live and ready to watch."
      >
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
        {!error && liveStreams.length === 0 ? (
          <p className="text-sm text-slate-400">No one is live right now. Check back soon or start your own stream.</p>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        {liveStreams.map((stream) => (
          <PublicStreamCard key={stream.id} stream={stream} />
        ))}
      </div>
    </div>
  );
}
