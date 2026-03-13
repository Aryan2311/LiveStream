"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Camera, Copy, Monitor, Radio, Trash2 } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { BrowserStudio } from "@/components/streams/browser-studio";
import { StreamCard } from "@/components/streams/stream-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { createStream, deleteStream, endStream, fetchStream, fetchStreams } from "@/lib/api";
import { ApiError, type Session, type Stream } from "@/lib/types";

type IngestMode = "browser" | "encoder";
type StudioStep = "setup" | "live";

const ACTIVE_STREAM_KEY = "studio_active_stream_id";
const ACTIVE_INGEST_KEY = "studio_active_ingest_mode";

function saveActiveStream(streamId: string, mode: IngestMode) {
  try {
    sessionStorage.setItem(ACTIVE_STREAM_KEY, streamId);
    sessionStorage.setItem(ACTIVE_INGEST_KEY, mode);
  } catch {}
}

function clearActiveStream() {
  try {
    sessionStorage.removeItem(ACTIVE_STREAM_KEY);
    sessionStorage.removeItem(ACTIVE_INGEST_KEY);
  } catch {}
}

function loadActiveStream(): { streamId: string; mode: IngestMode } | null {
  try {
    const streamId = sessionStorage.getItem(ACTIVE_STREAM_KEY);
    const mode = sessionStorage.getItem(ACTIVE_INGEST_KEY) as IngestMode | null;
    if (streamId) return { streamId, mode: mode || "browser" };
  } catch {}
  return null;
}

export function StudioContent() {
  const { session, isAuthenticated, isLoaded } = useSession();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ingestMode, setIngestMode] = useState<IngestMode>("browser");
  const [step, setStep] = useState<StudioStep>("setup");
  const [activeStream, setActiveStream] = useState<Stream | null>(null);
  const [resuming, setResuming] = useState(true);

  useEffect(() => {
    if (!session) {
      setStreams([]);
      setResuming(false);
      return;
    }

    fetchStreams(session)
      .then((payload) => {
        setStreams(payload);

        const saved = loadActiveStream();
        if (saved) {
          const match = payload.find(
            (s) => s.id === saved.streamId && s.status !== "ended",
          );
          if (match) {
            setActiveStream(match);
            setIngestMode(saved.mode);
            setStep("live");
          } else {
            clearActiveStream();
          }
        }
      })
      .catch(() => {
        setError("Unable to preload your streams.");
      })
      .finally(() => setResuming(false));
  }, [session]);

  const goToSetup = useCallback(() => {
    clearActiveStream();
    setStep("setup");
    setActiveStream(null);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setStreams((prev) => prev.filter((s) => s.id !== id));
  }, []);

  async function handleEndStream(stream: Stream) {
    if (!session) return;
    try {
      await endStream(session, stream.id);
      setStreams((prev) =>
        prev.map((s) => (s.id === stream.id ? { ...s, status: "ended" } : s)),
      );
    } catch {}
  }

  function resumeStream(stream: Stream, mode: IngestMode) {
    setActiveStream(stream);
    setIngestMode(mode);
    setStep("live");
    saveActiveStream(stream.id, mode);
  }

  async function handleCreateStream(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const stream = await createStream(session, { title, description });
      setStreams((current) => [stream, ...current]);
      setActiveStream(stream);
      setStep("live");
      saveActiveStream(stream.id, ingestMode);
      setTitle("");
      setDescription("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("We could not create your stream right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoaded || resuming) {
    return (
      <Panel title="Loading Studio" description="Preparing your creator workspace.">
        <p className="text-sm text-slate-400">Checking your current session.</p>
      </Panel>
    );
  }

  if (!isAuthenticated) {
    return (
      <Panel title="Sign in to open Studio" description="Create a creator account to set up streams and manage your channel.">
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

  if (step === "live" && activeStream) {
    if (ingestMode === "browser") {
      return (
        <div className="space-y-6">
          <BrowserStudio stream={activeStream} session={session!} />
          <Button variant="ghost" onClick={goToSetup}>
            Back to Studio setup
          </Button>
        </div>
      );
    }

    return <EncoderStudio stream={activeStream} session={session!} onBack={goToSetup} />;
  }

  const activeStreams = streams.filter(
    (s) => s.status === "created" || s.status === "live",
  );
  const pastStreams = streams.filter((s) => s.status === "ended");

  return (
    <div className="space-y-6">
      {activeStreams.length > 0 ? (
        <Panel
          title="Active streams"
          description="You have streams that are still live or waiting for a connection. Resume or end them."
        >
          <div className="space-y-3">
            {activeStreams.map((stream) => (
              <div
                key={stream.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-white">{stream.title}</p>
                  <p className="text-xs text-slate-400">
                    {stream.status === "live" ? "Currently live" : "Waiting for connection"}
                  </p>
                </div>
                <Badge tone={stream.status === "live" ? "success" : "default"}>
                  {stream.status === "live" ? "Live" : "Ready"}
                </Badge>
                <Button
                  variant="secondary"
                  onClick={() => resumeStream(stream, "browser")}
                >
                  <Camera size={16} />
                  Resume (Browser)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => resumeStream(stream, "encoder")}
                >
                  <Monitor size={16} />
                  Resume (OBS)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleEndStream(stream)}
                >
                  End
                </Button>
                {session ? (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      if (!confirm("Delete this stream? This cannot be undone.")) return;
                      try {
                        await deleteStream(session, stream.id);
                        handleDeleted(stream.id);
                      } catch {}
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Create a new stream" description="Choose how you want to go live, then fill in the details your viewers will see.">
          <form className="space-y-5" onSubmit={handleCreateStream}>
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-200">How do you want to stream?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIngestMode("browser")}
                  className={`flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition ${
                    ingestMode === "browser"
                      ? "border-cyan-400/50 bg-cyan-400/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <Camera size={28} />
                  <div>
                    <p className="text-sm font-semibold">Camera and mic</p>
                    <p className="mt-1 text-xs text-slate-400">Go live from your browser</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIngestMode("encoder")}
                  className={`flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition ${
                    ingestMode === "encoder"
                      ? "border-cyan-400/50 bg-cyan-400/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <Monitor size={28} />
                  <div>
                    <p className="text-sm font-semibold">OBS / Encoder</p>
                    <p className="mt-1 text-xs text-slate-400">Use external streaming software</p>
                  </div>
                </button>
              </div>
            </div>

            <Input
              label="Stream title"
              placeholder="Friday night stream"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <Textarea
              label="Description"
              placeholder="Tell viewers what this stream is about."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            {error ? (
              <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
            ) : null}

            <Button type="submit" disabled={isSubmitting}>
              <Radio size={16} />
              {isSubmitting ? "Creating..." : ingestMode === "browser" ? "Create stream and open camera" : "Create stream for encoder"}
            </Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="How it works" description="Two ways to go live, same great experience for your viewers.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Camera size={16} className="text-cyan-300" />
                  <p className="text-sm font-semibold text-white">Camera and mic</p>
                </div>
                <ol className="space-y-1 text-sm leading-6 text-slate-400">
                  <li>1. Create a stream and allow camera/mic access.</li>
                  <li>2. Preview yourself, adjust devices, then click Go live.</li>
                  <li>3. Share the watch link with your audience.</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Monitor size={16} className="text-cyan-300" />
                  <p className="text-sm font-semibold text-white">OBS / Encoder</p>
                </div>
                <ol className="space-y-1 text-sm leading-6 text-slate-400">
                  <li>1. Create a stream and copy the Server URL and Stream Key.</li>
                  <li>2. Paste them into OBS or your streaming software.</li>
                  <li>3. Start broadcasting and share the watch page.</li>
                </ol>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {pastStreams.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Past streams</h2>
          <div className="grid gap-6 xl:grid-cols-2">
            {pastStreams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                session={session}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EncoderStudio({
  stream,
  session,
  onBack,
}: {
  stream: Stream;
  session: Session;
  onBack: () => void;
}) {
  const [copiedField, setCopiedField] = useState<"server" | "key" | null>(null);
  const [ingestStatus, setIngestStatus] = useState<Stream["status"]>(stream.status);

  useEffect(() => {
    setIngestStatus(stream.status);
  }, [stream.id, stream.status]);

  useEffect(() => {
    const id = window.setInterval(() => {
      fetchStream(session, stream.id)
        .then((s) => setIngestStatus(s.status))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [session, stream.id]);

  const obsServerUrl = stream.rtmp_url.replace(
    new RegExp(`/${stream.stream_key}$`),
    "",
  );

  async function copyValue(value: string, field: "server" | "key") {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500);
  }

  return (
    <div className="space-y-6">
      <Panel
        title={stream.title}
        description={stream.description || "Your stream is ready for an encoder connection."}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={ingestStatus === "live" ? "success" : "default"}>
              {ingestStatus === "live" ? "Encoder connected — live" : "Waiting for encoder"}
            </Badge>
            <Link href={`/watch/${stream.id}`} target="_blank">
              <Button variant="secondary">Open watch page</Button>
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-300">
            Copy the Server URL and Stream Key below into OBS or your encoder.
            Once you start broadcasting, the stream will go live automatically.
          </p>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
            <p className="font-medium text-amber-50">OBS video tip</p>
            <p className="mt-1 text-amber-100/90">
              Default x264 often enables B-frames; WebRTC playback cannot use those. For lowest latency in the browser, use
              Output → Encoder x264 with Profile baseline, or add x264 option <code className="rounded bg-black/30 px-1">bf=0</code>.
              If you leave the default encoder, the watch page still plays the stream over HLS (a few seconds of delay).
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Server URL</p>
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
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Stream Key</p>
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
        </div>
      </Panel>

      <Panel title="Setup checklist" description="Follow these steps to connect your encoder and go live.">
        <ol className="space-y-3 text-sm leading-6 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-300">1</span>
            Open OBS Studio or your preferred encoder.
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-300">2</span>
            Go to Settings, then Stream. Set service to Custom, paste the Server URL and Stream Key.
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-300">3</span>
            Click Start Streaming in OBS. Your stream will appear on the watch page automatically.
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-300">4</span>
            Share the watch page link with your audience and keep this Studio open.
          </li>
        </ol>
      </Panel>

      <Button variant="ghost" onClick={onBack}>
        Back to Studio setup
      </Button>
    </div>
  );
}
