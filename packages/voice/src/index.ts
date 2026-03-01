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
  onDetectedLanguage?: (languageTag: string) => void;
  onAssistantDone?: () => void;
  onAssistantAudioStart?: () => void;
};

export class RealtimeSession {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private localStream: MediaStream | null = null;
  private state: ConnectionState = "idle";
  private peerConnected = false;
  private dataChannelOpened = false;

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
    this.peerConnected = false;
    this.dataChannelOpened = false;

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
    const channelReady = new Promise<void>((resolve) => {
      if (!this.dataChannel) {
        resolve();
        return;
      }
      this.dataChannel.onopen = () => {
        this.dataChannelOpened = true;
        this.maybeSetConnected();
        resolve();
      };
      this.dataChannel.onclose = () => {
        this.dataChannelOpened = false;
      };
      this.dataChannel.onerror = () => {
        this.dataChannelOpened = false;
      };
      this.dataChannel.onmessage = (event) => this.handleServerEvent(event.data);
    });

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      switch (this.peerConnection.connectionState) {
        case "connected":
          this.peerConnected = true;
          this.maybeSetConnected();
          break;
        case "disconnected":
        case "failed":
        case "closed":
          this.peerConnected = false;
          this.dataChannelOpened = false;
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
    await Promise.race([
      channelReady,
      new Promise<void>((resolve) => window.setTimeout(resolve, 4000))
    ]);
    this.maybeSetConnected();
  }

  updateInstructions(instructions: string) {
    this.sendEvent({
      type: "session.update",
      session: {
        instructions
      }
    });
  }

  updateSession(input: { instructions?: string; inputAudioLanguage?: string }) {
    this.sendEvent({
      type: "session.update",
      session: {
        ...(input.instructions ? { instructions: input.instructions } : {}),
        ...(input.inputAudioLanguage
          ? {
              input_audio_transcription: {
                model: "gpt-4o-mini-transcribe",
                language: input.inputAudioLanguage
              }
            }
          : {})
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
        language?: string;
      };

      if (!event.type) return;

      if (event.type.includes("response.audio") || event.type.includes("response.output_audio")) {
        this.config.onAssistantAudioStart?.();
      }

      if (event.type.includes("input_audio_transcription") && event.transcript) {
        if (typeof event.language === "string" && event.language.length > 0) {
          this.config.onDetectedLanguage?.(event.language);
        }
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

      if (
        event.type === "response.done" ||
        event.type.includes("response.audio.done") ||
        event.type.includes("response.output_audio.done")
      ) {
        this.config.onAssistantDone?.();
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

  private maybeSetConnected() {
    if (this.peerConnected && this.dataChannelOpened && this.state !== "connected") {
      this.setState("connected");
    }
  }

  private sendEvent(payload: unknown) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      return;
    }

    this.dataChannel.send(JSON.stringify(payload));
  }
}
