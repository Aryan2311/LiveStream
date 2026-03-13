"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSession } from "@/components/providers/session-provider";
import { StreamCard } from "@/components/streams/stream-card";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { fetchStreams } from "@/lib/api";
import { ApiError, type Stream } from "@/lib/types";

export function DashboardContent() {
  const { session, isAuthenticated, isLoaded } = useSession();

  if (!isLoaded) {
    return (
      <Panel title="Loading dashboard" description="Bringing your latest creator activity into view.">
        <p className="text-sm text-slate-400">Please wait while your streams load.</p>
      </Panel>
    );
  }

  if (!isAuthenticated) {
    return (
      <Panel title="Sign in required" description="Your dashboard is available once you sign in to your creator account.">
        <div className="flex flex-wrap gap-3">
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary">Create account</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  if (!session) {
    return null;
  }

  return <AuthenticatedDashboard session={session} />;
}

function AuthenticatedDashboard({ session }: { session: NonNullable<ReturnType<typeof useSession>["session"]> }) {
  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    fetchStreams(session)
      .then((payload) => {
        if (!isCancelled) {
          setStreams(payload);
        }
      })
      .catch((err) => {
        if (isCancelled) {
          return;
        }

        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Unable to fetch streams from the platform.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [session]);

  function handleDeleted(id: string) {
    setStreams((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  }

  if (streams === null && !error) {
    return (
      <Panel title="Loading dashboard" description="Bringing your latest creator activity into view.">
        <p className="text-sm text-slate-400">Please wait while your streams load.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Your streams"
        description="Review your latest broadcasts, jump into Studio, and keep your channel organized."
        action={
          <Link href="/studio">
            <Button>Create stream</Button>
          </Link>
        }
      >
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
        {!error && streams?.length === 0 ? (
          <p className="text-sm text-slate-400">You have not created a stream yet. Open Studio to set up your first live session.</p>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        {(streams || []).map((stream) => (
          <StreamCard key={stream.id} stream={stream} session={session} onDeleted={handleDeleted} />
        ))}
      </div>
    </div>
  );
}
