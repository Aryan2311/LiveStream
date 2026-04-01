const ICE_GATHERING_TIMEOUT_MS = 3000;
const MIN_BITRATE_KBPS = 2500;
const MAX_BITRATE_KBPS = 5000;
const START_BITRATE_KBPS = 4000;
const MAX_BITRATE_BPS = MAX_BITRATE_KBPS * 1000;

export type WHIPSessionState =
  | "idle"
  | "connecting"
  | "live"
  | "failed"
  | "closed";

export type WHIPSessionEvents = {
  onStateChange: (state: WHIPSessionState) => void;
  onStats?: (stats: { bitrate: number; frameRate: number }) => void;
};

export class WHIPSession {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private state: WHIPSessionState = "idle";
  private events: WHIPSessionEvents;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private prevBytesSent = 0;
  private prevTimestamp = 0;

  constructor(events: WHIPSessionEvents) {
    this.events = events;
  }

  getState() {
    return this.state;
  }

  async publish(whipUrl: string, stream: MediaStream) {
    this.setState("connecting");

    try {
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      this.pc.oniceconnectionstatechange = () => {
        const iceState = this.pc?.iceConnectionState;
        if (iceState === "connected" || iceState === "completed") {
          this.setState("live");
        } else if (iceState === "failed" || iceState === "disconnected") {
          this.setState("failed");
        }
      };

      for (const track of stream.getTracks()) {
        if (track.kind === "video" && "contentHint" in track) {
          track.contentHint = "motion";
        }
        const sender = this.pc.addTrack(track, stream);
        if (track.kind === "video") {
          this.preferH264High(sender);
        }
      }

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.waitForIceGathering();

      let sdp = this.pc.localDescription?.sdp;
      if (!sdp) {
        throw new Error("Failed to generate SDP offer");
      }

      sdp = this.injectBitrateConstraints(sdp);

      const response = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: sdp,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `WHIP server returned ${response.status}: ${text || response.statusText}`,
        );
      }

      const location = response.headers.get("Location");
      if (location) {
        this.resourceUrl = new URL(location, whipUrl).href;
      }

      const answerSdp = await response.text();
      await this.pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      await this.applyEncodingParameters();
      this.startStatsPolling();
    } catch (err) {
      this.setState("failed");
      throw err;
    }
  }

  async stop() {
    this.stopStatsPolling();

    if (this.resourceUrl) {
      try {
        await fetch(this.resourceUrl, { method: "DELETE" });
      } catch {
        // best-effort cleanup
      }
      this.resourceUrl = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.setState("closed");
  }

  private setState(state: WHIPSessionState) {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.events.onStateChange(state);
  }

  /**
   * Injects x-google-min/max/start-bitrate into H264 fmtp lines AND
   * adds b=AS to the video m-section. Together these clamp Chrome's GCC
   * congestion controller so it can't slash bitrate on local-network jitter.
   */
  private injectBitrateConstraints(sdp: string): string {
    const lines = sdp.split("\r\n");

    const h264PayloadTypes = new Set<string>();
    for (const line of lines) {
      const match = line.match(/^a=rtpmap:(\d+)\s+H264\//i);
      if (match) {
        h264PayloadTypes.add(match[1]);
      }
    }

    const out: string[] = [];
    let inVideo = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("m=video")) {
        inVideo = true;
        out.push(line);

        const next = lines[i + 1] || "";
        if (!next.startsWith("b=")) {
          out.push(`b=AS:${MAX_BITRATE_KBPS}`);
        }
        continue;
      }

      if (line.startsWith("m=") && !line.startsWith("m=video")) {
        inVideo = false;
      }

      if (inVideo && line.startsWith("a=fmtp:")) {
        const ptMatch = line.match(/^a=fmtp:(\d+)/);
        if (ptMatch && h264PayloadTypes.has(ptMatch[1])) {
          out.push(
            `${line};x-google-min-bitrate=${MIN_BITRATE_KBPS};x-google-max-bitrate=${MAX_BITRATE_KBPS};x-google-start-bitrate=${START_BITRATE_KBPS}`,
          );
          continue;
        }
      }

      out.push(line);
    }

    return out.join("\r\n");
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc || this.pc.iceGatheringState === "complete") {
        resolve();
        return;
      }

      const timeout = setTimeout(resolve, ICE_GATHERING_TIMEOUT_MS);

      this.pc.onicegatheringstatechange = () => {
        if (this.pc?.iceGatheringState === "complete") {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  private startStatsPolling() {
    this.statsInterval = setInterval(async () => {
      if (!this.pc || !this.events.onStats) {
        return;
      }

      try {
        const stats = await this.pc.getStats();
        let bytesSent = 0;
        let frameRate = 0;

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            bytesSent = report.bytesSent || 0;
            frameRate = report.framesPerSecond || 0;
          }
        });

        const now = performance.now();
        const elapsed = (now - this.prevTimestamp) / 1000;
        const bitrate =
          elapsed > 0
            ? ((bytesSent - this.prevBytesSent) * 8) / elapsed
            : 0;

        this.prevBytesSent = bytesSent;
        this.prevTimestamp = now;

        if (bitrate > 0) {
          this.events.onStats({ bitrate, frameRate });
        }
      } catch {
        // stats polling is best-effort
      }
    }, 2000);
  }

  private stopStatsPolling() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private async applyEncodingParameters() {
    if (!this.pc) {
      return;
    }

    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind !== "video") {
        continue;
      }

      const params = sender.getParameters();

      params.degradationPreference = "maintain-resolution";

      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      for (const encoding of params.encodings) {
        encoding.maxBitrate = MAX_BITRATE_BPS;
        encoding.maxFramerate = 30;
        encoding.scaleResolutionDownBy = 1.0;
      }

      try {
        await sender.setParameters(params);
      } catch {
        try {
          for (const encoding of params.encodings) {
            delete encoding.scaleResolutionDownBy;
          }
          await sender.setParameters(params);
        } catch {
          // give up on parameter tuning
        }
      }
    }
  }

  /**
   * Prefer H264 High profile (profile-level-id starting with 6400) for
   * better compression, then Main (4d00), then any other H264 variant,
   * then everything else as fallback.
   */
  private preferH264High(sender: RTCRtpSender) {
    if (!sender.track || !("getCapabilities" in RTCRtpSender)) {
      return;
    }

    const transceiver = this.pc
      ?.getTransceivers()
      .find((t) => t.sender === sender);
    if (!transceiver) {
      return;
    }

    const capabilities = RTCRtpSender.getCapabilities("video");
    if (!capabilities) {
      return;
    }

    type Codec = (typeof capabilities.codecs)[number];

    const isH264 = (c: Codec) =>
      c.mimeType.toLowerCase() === "video/h264";

    const profileId = (c: Codec) => {
      const match = c.sdpFmtpLine?.match(/profile-level-id=([0-9a-fA-F]+)/);
      return match?.[1]?.toLowerCase() ?? "";
    };

    const h264High = capabilities.codecs.filter(
      (c) => isH264(c) && profileId(c).startsWith("6400"),
    );
    const h264Main = capabilities.codecs.filter(
      (c) => isH264(c) && profileId(c).startsWith("4d00"),
    );
    const h264Other = capabilities.codecs.filter(
      (c) =>
        isH264(c) &&
        !profileId(c).startsWith("6400") &&
        !profileId(c).startsWith("4d00"),
    );
    const rest = capabilities.codecs.filter((c) => !isH264(c));

    const preferred = [...h264High, ...h264Main, ...h264Other, ...rest];

    if (h264High.length > 0 || h264Main.length > 0 || h264Other.length > 0) {
      transceiver.setCodecPreferences(preferred);
    }
  }
}
