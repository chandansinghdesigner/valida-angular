import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export type MediaKind = 'camera' | 'microphone' | 'screen';
export type CheckStatus = 'pending' | 'ok' | 'fail';
export interface CheckResult { status: CheckStatus; detail: string; }

/**
 * Owns the candidate's camera / microphone / screen streams for the whole
 * exam flow. Every capture goes through the browser permission prompt and
 * is started by an explicit candidate action — nothing is accessed silently.
 */
@Injectable({ providedIn: 'root' })
export class MediaSessionService {
  readonly cameraStream = signal<MediaStream | null>(null);
  readonly screenStream = signal<MediaStream | null>(null);

  /** Fires when a captured track ends (device unplugged, sharing stopped, ...). */
  readonly trackEnded$ = new Subject<MediaKind>();

  checkBrowser(): CheckResult {
    const missing: string[] = [];
    if (!navigator.mediaDevices?.getUserMedia) missing.push('camera/microphone API');
    if (!navigator.mediaDevices?.getDisplayMedia) missing.push('screen capture');
    if (typeof RTCPeerConnection === 'undefined') missing.push('WebRTC');
    if (!document.documentElement.requestFullscreen) missing.push('fullscreen');
    if (!window.isSecureContext) missing.push('secure context (HTTPS)');
    return missing.length
      ? { status: 'fail', detail: `Unsupported browser or setup — missing: ${missing.join(', ')}. Use a current desktop Chrome, Edge or Firefox.` }
      : { status: 'ok', detail: 'Supported browser' };
  }

  checkNetwork(): CheckResult {
    if (!navigator.onLine) return { status: 'fail', detail: 'You appear to be offline.' };
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const type = conn?.effectiveType;
    if (type === 'slow-2g' || type === '2g') return { status: 'fail', detail: `Connection too slow (${type}).` };
    return { status: 'ok', detail: type ? `Good (${type})` : 'Online' };
  }

  async checkWebRtc(): Promise<CheckResult> {
    if (typeof RTCPeerConnection === 'undefined') return { status: 'fail', detail: 'WebRTC is not available.' };
    const pc = new RTCPeerConnection({ iceServers: environment.iceServers });
    try {
      pc.createDataChannel('probe');
      await pc.setLocalDescription(await pc.createOffer());
      return { status: 'ok', detail: 'WebRTC ready' };
    } catch {
      return { status: 'fail', detail: 'WebRTC could not be initialised.' };
    } finally {
      pc.close();
    }
  }

  /** Asks for camera + microphone (one prompt); on failure probes each to report which one failed. */
  async requestCameraAndMic(): Promise<{ camera: CheckResult; microphone: CheckResult }> {
    this.stopCamera();
    try {
      this.setCamera(await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true
      }));
      return { camera: { status: 'ok', detail: 'Ready' }, microphone: { status: 'ok', detail: 'Ready' } };
    } catch {
      const probe = async (c: MediaStreamConstraints): Promise<CheckResult> => {
        try {
          (await navigator.mediaDevices.getUserMedia(c)).getTracks().forEach((t) => t.stop());
          return { status: 'ok', detail: 'Available' };
        } catch (e) { return { status: 'fail', detail: this.describe(e) }; }
      };
      return { camera: await probe({ video: true }), microphone: await probe({ audio: true }) };
    }
  }

  async requestScreen(): Promise<CheckResult> {
    this.stopScreen();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const surface = (stream.getVideoTracks()[0].getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
      if (surface && surface !== 'monitor') {
        stream.getTracks().forEach((t) => t.stop());
        return { status: 'fail', detail: 'Please share your entire screen, not a window or tab.' };
      }
      stream.getVideoTracks()[0].addEventListener('ended', () => this.trackEnded$.next('screen'));
      this.screenStream.set(stream);
      return { status: 'ok', detail: 'Sharing entire screen' };
    } catch (e) {
      return { status: 'fail', detail: this.describe(e) };
    }
  }

  stopCamera(): void { this.stop(this.cameraStream); }
  stopScreen(): void { this.stop(this.screenStream); }
  stopAll(): void { this.stopCamera(); this.stopScreen(); }

  private setCamera(stream: MediaStream): void {
    stream.getVideoTracks().forEach((t) => t.addEventListener('ended', () => this.trackEnded$.next('camera')));
    stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => this.trackEnded$.next('microphone')));
    this.cameraStream.set(stream);
  }

  private stop(s: { (): MediaStream | null; set(v: MediaStream | null): void }): void {
    s()?.getTracks().forEach((t) => t.stop());
    s.set(null);
  }

  private describe(e: unknown): string {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError') return 'Permission was denied. Allow access in your browser settings and try again.';
    if (name === 'NotFoundError') return 'No device found.';
    if (name === 'NotReadableError') return 'The device is in use by another application.';
    return 'Could not access the device.';
  }
}
