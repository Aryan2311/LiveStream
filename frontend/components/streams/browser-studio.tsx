"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ClipboardCopy, Mic, MicOff, Radio, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { endStream, goLiveStream } from "@/lib/api";
import { WHIPSession, type WHIPSessionState } from "@/lib/whip";
import type { Session, Stream } from "@/lib/types";

type BrowserStudioProps = {
  stream: Stream;
  session: Session;
};

type DeviceInfo = {
  deviceId: string;
  label: string;
};

function formatBitrate(bps: number) {
  if (bps > 1_000_000) {
    return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  }
  if (bps > 1_000) {
    return `${(bps / 1_000).toFixed(0)} Kbps`;
  }
  return `${bps.toFixed(0)} bps`;
}

function stateLabel(state: WHIPSessionState): string {
  switch (state) {
    case "idle":
      return "Ready";
    case "connecting":
      return "Connecting";
    case "live":
      return "Live";
    case "failed":
      return "Connection lost";
    case "closed":
      return "Ended";
  }
}

function stateTone(state: WHIPSessionState): "default" | "success" | "warning" {
  switch (state) {
    case "live":
      return "success";
    case "failed":
      return "warning";
    default:
      return "default";
  }
}

export function BrowserStudio({ stream, session }: BrowserStudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const whipRef = useRef<WHIPSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(session);
  const streamIdRef = useRef(stream.id);
  const publishStateRef = useRef<WHIPSessionState>("idle");

  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [mics, setMics] = useState<DeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<WHIPSessionState>("idle");
  const [stats, setStats] = useState<{ bitrate: number; frameRate: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  sessionRef.current = session;
  streamIdRef.current = stream.id;

  const updatePublishState = useCallback((state: WHIPSessionState) => {
    publishStateRef.current = state;
    setPublishState(state);
  }, []);

  const teardown = useCallback(async () => {
    if (whipRef.current) {
      await whipRef.current.stop();
      whipRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` }));
      const audioInputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` }));

      setCameras(videoInputs);
      setMics(audioInputs);

      if (videoInputs.length > 0 && !selectedCamera) {
        setSelectedCamera(videoInputs[0].deviceId);
      }
      if (audioInputs.length > 0 && !selectedMic) {
        setSelectedMic(audioInputs[0].deviceId);
      }
    } catch {
      setPermissionError("Could not list devices.");
    }
  }, [selectedCamera, selectedMic]);

  const startPreview = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const videoConstraints: MediaTrackConstraints = {
        width: { min: 1280, ideal: 1280 },
        height: { min: 720, ideal: 720 },
        frameRate: { ideal: 30 },
      };
      if (selectedCamera) {
        videoConstraints.deviceId = { exact: selectedCamera };
      }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };

      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = ms;

      if (videoRef.current) {
        videoRef.current.srcObject = ms;
      }

      setPermissionGranted(true);
      setPermissionError(null);
      await enumerateDevices();
    } catch (err) {
      setPermissionGranted(false);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionError("Camera/mic permission was denied. Please allow access in your browser settings.");
      } else {
        setPermissionError("Could not access your camera or microphone.");
      }
    }
  }, [selectedCamera, selectedMic, enumerateDevices]);

  useEffect(() => {
    startPreview();

    return () => {
      const wasLive =
        publishStateRef.current === "live" ||
        publishStateRef.current === "connecting";

      if (whipRef.current) {
        whipRef.current.stop();
        whipRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      if (wasLive) {
        endStream(sessionRef.current, streamIdRef.current).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!permissionGranted) {
      return;
    }
    startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera, selectedMic]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (
        publishStateRef.current !== "live" &&
        publishStateRef.current !== "connecting"
      ) {
        return;
      }

      e.preventDefault();

      const url = `/streams/end/${streamIdRef.current}`;
      const body = JSON.stringify({});
      const headers = {
        type: "application/json",
        Authorization: `Bearer ${sessionRef.current.token}`,
      };
      const blob = new Blob([body], headers);
      navigator.sendBeacon(url, blob);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  function toggleCamera() {
    const ms = mediaStreamRef.current;
    if (!ms) {
      return;
    }

    const enabled = !cameraEnabled;
    ms.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
    setCameraEnabled(enabled);
  }

  function toggleMic() {
    const ms = mediaStreamRef.current;
    if (!ms) {
      return;
    }

    const enabled = !micEnabled;
    ms.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
    setMicEnabled(enabled);
  }

  async function goLive() {
    if (!mediaStreamRef.current) {
      return;
    }

    setError(null);

    const whipUrl = stream.whip_url.replace(/^https?:\/\/[^/]+/, "");
    const proxyUrl = `/whip${whipUrl.replace(/^\/whip/, "")}`;
    const fullUrl = `${window.location.origin}${proxyUrl}`;

    const whipSession = new WHIPSession({
      onStateChange: (state) => {
        updatePublishState(state);
        if (state === "live") {
          goLiveStream(session, stream.id).catch(() => {});
        }
      },
      onStats: (s) => setStats(s),
    });

    whipRef.current = whipSession;

    try {
      await whipSession.publish(fullUrl, mediaStreamRef.current);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to the streaming server.",
      );
    }
  }

  async function stopStream() {
    await teardown();
    updatePublishState("closed");
    setStats(null);
    try { sessionStorage.removeItem("studio_active_stream_id"); } catch {}
    endStream(session, stream.id).catch(() => {});
  }

  async function copyWatchLink() {
    const url = `${window.location.origin}/watch/${stream.id}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  }

  const isLiveOrConnecting =
    publishState === "live" || publishState === "connecting";

  return (
    <div className="space-y-6">
      <Panel
        title={stream.title}
        description={stream.description || "Your browser studio is ready."}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={stateTone(publishState)}>
              {stateLabel(publishState)}
            </Badge>
            {publishState === "live" ? (
              <Button variant="secondary" onClick={copyWatchLink}>
                <ClipboardCopy size={16} />
                {linkCopied ? "Copied!" : "Copy watch link"}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full"
            />
            {publishState === "live" ? (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                <Radio size={14} />
                LIVE
              </div>
            ) : null}
            {stats && publishState === "live" ? (
              <div className="absolute bottom-4 right-4 rounded-xl bg-black/70 px-3 py-2 text-xs text-slate-300 backdrop-blur">
                {formatBitrate(stats.bitrate)} &middot;{" "}
                {stats.frameRate.toFixed(0)} fps
              </div>
            ) : null}
          </div>

          {permissionError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {permissionError}
              <Button className="mt-2" onClick={startPreview}>
                Try again
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={cameraEnabled ? "secondary" : "danger"}
              onClick={toggleCamera}
              disabled={!permissionGranted}
            >
              {cameraEnabled ? (
                <Camera size={16} />
              ) : (
                <CameraOff size={16} />
              )}
              {cameraEnabled ? "Camera on" : "Camera off"}
            </Button>
            <Button
              variant={micEnabled ? "secondary" : "danger"}
              onClick={toggleMic}
              disabled={!permissionGranted}
            >
              {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
              {micEnabled ? "Mic on" : "Mic off"}
            </Button>

            <div className="flex-1" />

            {!isLiveOrConnecting ? (
              <Button onClick={goLive} disabled={!permissionGranted}>
                <Radio size={16} />
                Go live
              </Button>
            ) : (
              <Button variant="danger" onClick={stopStream}>
                <Square size={16} />
                End stream
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {permissionGranted ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel
            title="Camera"
            description="Select which camera to use for your stream."
          >
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none"
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              disabled={isLiveOrConnecting}
            >
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          </Panel>
          <Panel
            title="Microphone"
            description="Select which microphone to use for your stream."
          >
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none"
              value={selectedMic}
              onChange={(e) => setSelectedMic(e.target.value)}
              disabled={isLiveOrConnecting}
            >
              {mics.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
