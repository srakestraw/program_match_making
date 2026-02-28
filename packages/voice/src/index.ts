export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type TranscriptTurn = {
  id: string;
  ts: string;
  speaker: "candidate" | "assistant";
  text: string;
};

export type RealtimeSessionConfig = {
  model?: string;
  onTranscriptTurn?: (turn: TranscriptTurn) => void;
  onStateChange?: (state: ConnectionState) => void;
};

export class RealtimeSession {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private localStream: MediaStream | null = null;
  private state: ConnectionState = "idle";

  constructor(private readonly config: RealtimeSessionConfig = {}) {}

  get connectionState() {
    return this.state;
  }

  setAudioTrack(track: MediaStreamTrack) {
    this.audioTrack = track;
    this.audioTrack.enabled = false;
  }

  setPushToTalk(pressed: boolean) {
    if (this.audioTrack) {
      this.audioTrack.enabled = pressed;
    }
  }

  async connect(ephemeralKey: string) {
    this.setState("connecting");

    this.peerConnection = new RTCPeerConnection();
    this.localStream = new MediaStream();

    if (this.audioTrack) {
      this.localStream.addTrack(this.audioTrack);
      this.peerConnection.addTrack(this.audioTrack, this.localStream);
    }

    const remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      remoteAudio.srcObject = stream;
    };

    this.dataChannel = this.peerConnection.createDataChannel("oai-events");
    this.dataChannel.onmessage = (event) => this.handleServerEvent(event.data);

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      switch (this.peerConnection.connectionState) {
        case "connected":
          this.setState("connected");
          break;
        case "disconnected":
        case "failed":
        case "closed":
          this.setState("disconnected");
          break;
        default:
          break;
      }
    };

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    const model = this.config.model ?? "gpt-4o-realtime-preview";
    const response = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      }
    });

    if (!response.ok) {
      this.setState("error");
      throw new Error("Failed to establish realtime connection");
    }

    const answer = await response.text();
    await this.peerConnection.setRemoteDescription({ type: "answer", sdp: answer });

    this.setState("connected");
  }

  updateInstructions(instructions: string) {
    this.sendEvent({
      type: "session.update",
      session: {
        instructions
      }
    });
  }

  promptAssistant(prompt: string) {
    this.sendEvent({
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions: prompt
      }
    });
  }

  private handleServerEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as {
        type?: string;
        transcript?: string;
        delta?: string;
        item_id?: string;
      };

      if (!event.type) return;

      if (event.type.includes("input_audio_transcription") && event.transcript) {
        this.config.onTranscriptTurn?.({
          id: event.item_id ?? crypto.randomUUID(),
          ts: new Date().toISOString(),
          speaker: "candidate",
          text: event.transcript
        });
      }

      if (event.type.includes("response.audio_transcript") && event.delta) {
        this.config.onTranscriptTurn?.({
          id: event.item_id ?? crypto.randomUUID(),
          ts: new Date().toISOString(),
          speaker: "assistant",
          text: event.delta
        });
      }
    } catch {
      // Ignore malformed events from the wire.
    }
  }

  async disconnect() {
    this.setPushToTalk(false);
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.dataChannel = null;
    this.peerConnection = null;
    this.localStream = null;
    this.setState("disconnected");
  }

  private setState(state: ConnectionState) {
    this.state = state;
    this.config.onStateChange?.(state);
  }

  private sendEvent(payload: unknown) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      return;
    }

    this.dataChannel.send(JSON.stringify(payload));
  }
}
