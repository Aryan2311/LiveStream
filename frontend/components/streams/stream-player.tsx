"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

import { WHEPPlayer, type WHEPPlayerState } from "@/lib/whep";

type StreamPlayerProps = {
  playbackUrl: string;
  streamKey?: string;
};

/** Prefer same-origin URL so playback always hits the site ingress. */
function resolvePlaybackSrc(playbackUrl: string): string {
  try {
    const u = new URL(playbackUrl, typeof window !== "undefined" ? window.location.origin : undefined);
    if (typeof window !== "undefined" && u.origin !== window.location.origin) {
      return `${window.location.origin}${u.pathname}${u.search}`;
    }
    return u.href;
  } catch {
    return playbackUrl;
  }
}

export function StreamPlayer({ playbackUrl, streamKey }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<WHEPPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<WHEPPlayerState>("idle");
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  const onStateChange = useCallback((s: WHEPPlayerState) => setState(s), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const key = streamKey || extractStreamKey(playbackUrl);
    if (!key) {
      setError("Unable to determine stream key for playback.");
      return undefined;
    }

    const whepUrl = `${window.location.origin}/whep/live/${key}/whep`;
    const hlsSrc = resolvePlaybackSrc(playbackUrl);

    let cancelled = false;
    let switchedToHls = false;
    let whepPlayer: WHEPPlayer | null = null;
    let hlsCleanup: (() => void) | null = null;
    let whepTimeout: number | undefined;

    const tryHls = () => {
      if (cancelled || switchedToHls) return;
      switchedToHls = true;
      if (whepTimeout !== undefined) {
        window.clearTimeout(whepTimeout);
      }

      setFallbackNote(
        "Using HLS playback. OBS often uses H.264 with B-frames; WebRTC cannot play that, so we fall back here. For lower latency, set x264 Profile to baseline or add custom option bf=0.",
      );
      setError(null);

      whepPlayer?.stop();
      whepPlayer = null;
      playerRef.current = null;

      video.srcObject = null;

      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          enableWorker: true,
        });
        hls.loadSource(hlsSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setError("Could not play the HLS stream. Try refreshing.");
          }
        });
        hlsCleanup = () => {
          hls.destroy();
          hlsCleanup = null;
        };
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsSrc;
        void video.play().catch(() => {});
        hlsCleanup = () => {
          video.removeAttribute("src");
          video.load();
          hlsCleanup = null;
        };
      } else {
        setError("This browser cannot play this stream.");
      }
    };

    whepPlayer = new WHEPPlayer({
      onStateChange: (s) => {
        onStateChange(s);
        if (s === "playing") {
          if (whepTimeout !== undefined) {
            window.clearTimeout(whepTimeout);
          }
        }
        if (s === "failed") {
          tryHls();
        }
      },
    });
    playerRef.current = whepPlayer;

    whepTimeout = window.setTimeout(() => {
      if (cancelled || switchedToHls) return;
      if (whepPlayer && whepPlayer.getState() !== "playing") {
        tryHls();
      }
    }, 8000);

    whepPlayer.play(whepUrl, video).catch(() => {
      if (!cancelled) tryHls();
    });

    return () => {
      cancelled = true;
      if (whepTimeout !== undefined) {
        window.clearTimeout(whepTimeout);
      }
      whepPlayer?.stop();
      hlsCleanup?.();
      playerRef.current = null;
    };
  }, [playbackUrl, streamKey, onStateChange]);

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        className="aspect-video w-full rounded-3xl border border-white/10 bg-slate-950 object-contain"
      />
      {state === "connecting" && !fallbackNote ? (
        <p className="text-sm text-slate-400">Connecting to live stream...</p>
      ) : null}
      {fallbackNote ? <p className="text-sm text-slate-400">{fallbackNote}</p> : null}
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
    </div>
  );
}

function extractStreamKey(playbackUrl: string): string | null {
  const match = playbackUrl.match(/\/hls\/([^/?#]+)/);
  return match?.[1] ?? null;
}
