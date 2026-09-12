/**
 * WebRTC call engine — manages peer connections, local media capture,
 * and ICE/SDP signaling for 1:1 audio and video calls.
 *
 * Signaling is transported by the caller (typically the useCall hook)
 * via the onSignal callback; incoming signals are fed back through handleSignal.
 */

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export class CallEngine {
  constructor({ onStateChange, onRemoteStream, onLocalStream, onSignal }) {
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.callId = null;
    this.role = null; // 'caller' | 'callee'
    this.state = "idle";
    this.muted = false;
    this.videoEnabled = true;
    this.pendingCandidates = [];
    this.operationGeneration = 0;

    this.onStateChange = onStateChange;
    this.onRemoteStream = onRemoteStream;
    this.onLocalStream = onLocalStream;
    this.onSignal = onSignal;
  }

  _setState(state) {
    this.state = state;
    this.onStateChange?.(state);
  }

  async _getLocalMedia({ video, generation }) {
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: video
        ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (generation !== this.operationGeneration) {
      stream.getTracks().forEach((track) => track.stop());
      const error = new Error("Call setup cancelled");
      error.name = "AbortError";
      throw error;
    }
    this.localStream = stream;
    this.onLocalStream?.(this.localStream);
    return this.localStream;
  }

  _createPeerConnection() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        Promise.resolve(
          this.onSignal?.({ type: "ice", callId: this.callId, payload: event.candidate })
        ).catch(() => this._setState("failed"));
      }
    };

    this.pc.onconnectionstatechange = () => {
      const cs = this.pc?.connectionState;
      if (cs === "connected") this._setState("connected");
      else if (cs === "disconnected") this._setState("reconnecting");
      else if (cs === "failed") this._setState("failed");
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    return this.pc;
  }

  async startCall({ callId, type }) {
    const generation = ++this.operationGeneration;
    this.callId = callId;
    this.role = "caller";
    const video = type === "video";

    await this._getLocalMedia({ video, generation });
    if (generation !== this.operationGeneration || this.callId !== callId) {
      const error = new Error("Call setup cancelled");
      error.name = "AbortError";
      throw error;
    }
    this.videoEnabled = video;
    this._createPeerConnection();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this._setState("ringing");
    await this.onSignal?.({ type: "offer", callId, callType: type, payload: offer });
  }

  async acceptCall({ callId, type, offer }) {
    const generation = ++this.operationGeneration;
    this.callId = callId;
    this.role = "callee";
    const video = type === "video";

    await this._getLocalMedia({ video, generation });
    if (generation !== this.operationGeneration || this.callId !== callId) {
      const error = new Error("Call setup cancelled");
      error.name = "AbortError";
      throw error;
    }
    this.videoEnabled = video;
    this._createPeerConnection();

    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Flush any ICE candidates that arrived before the offer.
    for (const candidate of this.pendingCandidates) {
      try { await this.pc.addIceCandidate(candidate); } catch {}
    }
    this.pendingCandidates = [];

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this._setState("connecting");
    await this.onSignal?.({ type: "answer", callId, payload: answer });
  }

  async handleSignal(signal) {
    if (signal.callId !== this.callId) return;

    if (signal.type === "answer") {
      await this.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      for (const candidate of this.pendingCandidates) {
        try { await this.pc.addIceCandidate(candidate); } catch {}
      }
      this.pendingCandidates = [];
    } else if (signal.type === "ice") {
      if (this.pc?.remoteDescription) {
        try { await this.pc.addIceCandidate(signal.payload); } catch {}
      } else {
        this.pendingCandidates.push(signal.payload);
      }
    } else if (signal.type === "end") {
      this._cleanup();
      this._setState("ended");
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    return this.muted;
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled;
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = this.videoEnabled));
    return this.videoEnabled;
  }

  _cleanup() {
    this.operationGeneration += 1;
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.pendingCandidates = [];
  }

  endCall() {
    if (this.callId) {
      Promise.resolve(this.onSignal?.({ type: "end", callId: this.callId }))
        .catch((error) => console.error("Failed to send call end signal:", error));
    }
    this._cleanup();
    this._setState("ended");
  }
}