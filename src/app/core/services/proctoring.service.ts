import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SessionState = 'idle' | 'connecting' | 'live' | 'ended' | 'error';

/**
 * Manages the WebRTC peer connection(s) used to receive a candidate's
 * camera feed and screen-share feed during a live proctoring session.
 *
 * In production the candidate's browser is the "offerer" and this proctor
 * console is the "answerer": signalling (SDP offer/answer + ICE candidates)
 * is expected to travel over your existing SignalR hub or REST endpoint —
 * plug your signalling transport into `handleRemoteOffer` / `sendLocalIce`.
 *
 * For local development without a real candidate client, `startMockSession()`
 * synthesizes a video feed (camera) and a canvas-based feed (screen) via
 * getUserMedia/getDisplayMedia or generated canvas streams, so the dashboard
 * and live-proctoring UI can be built and demoed end-to-end.
 */
@Injectable({ providedIn: 'root' })
export class ProctoringService {
  private peerConnection: RTCPeerConnection | null = null;

  private cameraStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  readonly cameraStream$ = this.cameraStreamSubject.asObservable();

  private screenStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  readonly screenStream$ = this.screenStreamSubject.asObservable();

  private stateSubject = new BehaviorSubject<SessionState>('idle');
  readonly state$ = this.stateSubject.asObservable();

  private mockCanvasHandle: number | null = null;

  // ---------------------------------------------------------------------
  // Real WebRTC signalling (wire this up to your SignalR/REST signalling)
  // ---------------------------------------------------------------------

  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: environment.iceServers });

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      // Convention: track.label / a companion data-channel message tells us
      // whether this is the camera or the screen-share track. Adjust to
      // match whatever your signalling server negotiates.
      if (event.track.kind === 'video') {
        if (!this.cameraStreamSubject.value) {
          this.cameraStreamSubject.next(stream);
        } else if (!this.screenStreamSubject.value && stream !== this.cameraStreamSubject.value) {
          this.screenStreamSubject.next(stream);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.stateSubject.next('live');
          break;
        case 'disconnected':
        case 'closed':
          this.stateSubject.next('ended');
          break;
        case 'failed':
          this.stateSubject.next('error');
          break;
      }
    };

    return pc;
  }

  /** Call when a remote SDP offer arrives over your signalling channel. */
  async handleRemoteOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.stateSubject.next('connecting');
    this.peerConnection = this.createPeerConnection();
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /** Call when a remote ICE candidate arrives over your signalling channel. */
  async addRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.peerConnection?.addIceCandidate(candidate);
  }

  /** Register your own signalling transport's "send ICE candidate" callback. */
  onLocalIceCandidate(callback: (candidate: RTCIceCandidate) => void): void {
    if (!this.peerConnection) return;
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) callback(event.candidate);
    };
  }

  // ---------------------------------------------------------------------
  // Mock / fallback mode for local development & testing
  // ---------------------------------------------------------------------

  /**
   * Simulates an incoming candidate camera feed (via the local webcam, if
   * granted) and a synthetic "screen share" feed (via an animated canvas),
   * so the Live Proctoring UI is fully exercisable without a backend.
   */
  async startMockSession(): Promise<void> {
    this.stateSubject.next('connecting');
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.cameraStreamSubject.next(camera);
    } catch {
      this.cameraStreamSubject.next(this.buildPlaceholderStream('Candidate Camera'));
    }

    this.screenStreamSubject.next(this.buildPlaceholderStream('Screen Share', '#101c33'));
    this.stateSubject.next('live');
  }

  /** Stops all tracks and resets state — used by "End Proctoring". */
  endSession(): void {
    [this.cameraStreamSubject.value, this.screenStreamSubject.value].forEach((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
    });
    if (this.mockCanvasHandle) {
      cancelAnimationFrame(this.mockCanvasHandle);
      this.mockCanvasHandle = null;
    }
    this.cameraStreamSubject.next(null);
    this.screenStreamSubject.next(null);
    this.peerConnection?.close();
    this.peerConnection = null;
    this.stateSubject.next('ended');
  }

  /** Builds a lightweight animated canvas MediaStream as a stand-in feed. */
  private buildPlaceholderStream(label: string, bg = '#1d2545'): MediaStream {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const t = Date.now() / 1000;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '20px sans-serif';
      ctx.fillText(label, 24, 40);
      ctx.beginPath();
      ctx.arc(320 + Math.sin(t) * 80, 200, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#4ce3da';
      ctx.fill();
      this.mockCanvasHandle = requestAnimationFrame(draw);
    };
    draw();

    return (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(24);
  }
}
