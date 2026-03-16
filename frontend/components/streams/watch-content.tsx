"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSession } from "@/components/providers/session-provider";
import { ChatPanel } from "@/components/streams/chat-panel";
import { StreamPlayer } from "@/components/streams/stream-player";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { fetchPublicStream } from "@/lib/api";
import { ApiError, type PublicStream } from "@/lib/types";

type WatchContentProps = {
  streamId: string;
};

export function WatchContent({ streamId }: WatchContentProps) {
  const { session } = useSession();
  const [stream, setStream] = useState<PublicStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchPublicStream(streamId)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setStream(payload);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Unable to load stream details.");
        }
        setStream(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [streamId]);

  if (error) {
    return (
      <Panel title="Unable to load stream" description="This channel is unavailable right now.">
        <p className="text-sm text-rose-200">{error}</p>
      </Panel>
    );
  }

  if (isLoading || !stream) {
    return (
      <Panel title="Loading stream" description="Getting the live stream ready for playback.">
        <p className="text-sm text-slate-400">Please wait while the watch page initializes.</p>
      </Panel>
    );
  }

  const isLive = stream.status === "live";
  const isEnded = stream.status === "ended";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Panel
          title={stream.title}
          description={stream.description || "Join the live stream and stay for the chat."}
          action={
            <div className="flex items-center gap-3">
              <Badge tone={isLive ? "success" : isEnded ? "warning" : "default"}>
                {isLive ? "Live" : isEnded ? "Ended" : "Starting soon"}
              </Badge>
            </div>
          }
        >
          {isLive ? (
            <StreamPlayer playbackUrl={stream.playback_url} />
          ) : isEnded ? (
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50 text-center">
              <div>
                <p className="text-lg font-semibold text-slate-200">Stream has ended</p>
                <p className="mt-1 text-sm text-slate-400">This broadcast is no longer live.</p>
              </div>
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50 text-center">
              <div>
                <p className="text-lg font-semibold text-slate-200">Starting soon</p>
                <p className="mt-1 text-sm text-slate-400">The creator is setting up. The stream will appear here automatically.</p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="About this stream" description="Watch live, stay in the conversation, and follow along as the creator broadcasts.">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/browse"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Browse more live streams
            </Link>
            {!session ? (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
              >
                Sign in to chat
              </Link>
            ) : null}
          </div>
        </Panel>
      </div>

      <ChatPanel streamId={stream.id} />
    </div>
  );
}
