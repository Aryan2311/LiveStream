export type WHEPPlayerState = "idle" | "connecting" | "playing" | "failed" | "closed";

export type WHEPPlayerEvents = {
  onStateChange: (state: WHEPPlayerState) => void;
};

export class WHEPPlayer {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private state: WHEPPlayerState = "idle";
  private events: WHEPPlayerEvents;

  constructor(events: WHEPPlayerEvents) {
    this.events = events;
  }

  getState() {
    return this.state;
  }

  async play(whepUrl: string, videoElement: HTMLVideoElement) {
    this.setState("connecting");

    try {
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("audio", { direction: "recvonly" });

      this.pc.ontrack = (event) => {
        if (event.streams[0]) {
          videoElement.srcObject = event.streams[0];
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        const iceState = this.pc?.iceConnectionState;
        if (iceState === "connected" || iceState === "completed") {
          this.setState("playing");
        } else if (iceState === "failed" || iceState === "disconnected") {
          this.setState("failed");
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.waitForIceGathering();

      const sdp = this.pc.localDescription?.sdp;
      if (!sdp) {
        throw new Error("Failed to generate SDP offer");
      }

      const response = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: sdp,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `WHEP server returned ${response.status}: ${text || response.statusText}`,
        );
      }

      const location = response.headers.get("Location");
      if (location) {
        this.resourceUrl = new URL(location, whepUrl).href;
      }

      const answerSdp = await response.text();
      await this.pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (err) {
      this.setState("failed");
      throw err;
    }
  }

  async stop() {
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

  private setState(state: WHEPPlayerState) {
    if (this.state === state) return;
    this.state = state;
    this.events.onStateChange(state);
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc || this.pc.iceGatheringState === "complete") {
        resolve();
        return;
      }

      const timeout = setTimeout(resolve, 3000);

      this.pc.onicegatheringstatechange = () => {
        if (this.pc?.iceGatheringState === "complete") {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }
}
