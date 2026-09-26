import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService, HubConnectionStatus } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatMessage } from '../../core/models/chat-message.model';

@Component({
  selector: 'app-live-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './live-chat.component.html',
  styleUrl: './live-chat.component.css'
})
export class LiveChatComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  private chat = inject(ChatService);
  private auth = inject(AuthService);
  private sub = new Subscription();

  /** The exam/session id used as the SignalR chat room key. */
  @Input({ required: true }) sessionId!: string;

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  status: HubConnectionStatus = 'disconnected';
  draft = '';
  sending = false;
  /** True for a brief moment right after a new inbound message, to drive a flash/visual alert. */
  flash = false;

  private audioCtx?: AudioContext;
  private shouldScroll = false;

  ngOnInit(): void {
    this.connect();

    this.sub.add(this.chat.messages$.subscribe((msgs) => {
      this.messages = msgs;
      this.shouldScroll = true;
    }));

    this.sub.add(this.chat.status$.subscribe((status) => (this.status = status)));

    this.sub.add(this.chat.incomingMessage$.subscribe((message) => {
      if (message.sender !== 'proctor') {
        this.playAlertSound();
        this.triggerFlash();
      }
    }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId'] && !changes['sessionId'].firstChange) {
      this.connect();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.chat.disconnect();
  }

  private async connect(): Promise<void> {
    if (!this.sessionId) return;
    try {
      await this.chat.connect(this.sessionId);
    } catch {
      // SignalR hub may not be reachable in local/dev mode — the UI still renders,
      // and sendMessage() will surface a friendly error if attempted while offline.
    }
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text) return;

    this.sending = true;
    try {
      await this.chat.sendMessage(this.sessionId, text);
      this.draft = '';
    } catch {
      // No live hub connected (e.g. local dev without a backend yet) — echo it locally
      // so the UI/UX can still be demoed end-to-end.
      this.chat.pushLocal({
        id: crypto.randomUUID(),
        sender: 'proctor',
        senderName: this.auth.currentUser?.name ?? 'Proctor',
        text,
        timestamp: new Date()
      });
      this.draft = '';
    } finally {
      this.sending = false;
    }
  }

  /** Short beep via the Web Audio API — no external asset needed for the alert sound. */
  private playAlertSound(): void {
    try {
      this.audioCtx ??= new AudioContext();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, this.audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);
      osc.connect(gain).connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);
    } catch {
      // Audio may be blocked until the user interacts with the page — safe to ignore.
    }
  }

  private triggerFlash(): void {
    this.flash = true;
    setTimeout(() => (this.flash = false), 900);
  }
}
