import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { LiveChatComponent } from '../live-chat/live-chat.component';
import { ProctoringService, SessionState } from '../../core/services/proctoring.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-live-proctoring',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, LiveChatComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './live-proctoring.component.html',
  styleUrl: './live-proctoring.component.css'
})
export class LiveProctoringComponent implements AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private proctoring = inject(ProctoringService);
  private alerts = inject(AlertService);
  private sub = new Subscription();

  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('screenVideo') screenVideoRef?: ElementRef<HTMLVideoElement>;

  examId = this.route.snapshot.paramMap.get('examId') ?? '—';
  state: SessionState = 'idle';
  hasCamera = false;
  hasScreen = false;
  showChat = true;

  ngAfterViewInit(): void {
    this.sub.add(
      this.proctoring.cameraStream$.subscribe((stream) => {
        this.hasCamera = !!stream;
        if (this.cameraVideoRef) {
          this.cameraVideoRef.nativeElement.srcObject = stream;
        }
      })
    );

    this.sub.add(
      this.proctoring.screenStream$.subscribe((stream) => {
        this.hasScreen = !!stream;
        if (this.screenVideoRef) {
          this.screenVideoRef.nativeElement.srcObject = stream;
        }
      })
    );

    this.sub.add(this.proctoring.state$.subscribe((state) => (this.state = state)));
    this.alerts.connect();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.proctoring.endSession();
  }

  /** Fallback/mock control: simulates an incoming candidate camera + screen feed for dev/testing. */
  startMockSession(): void {
    this.proctoring.startMockSession();
  }

  endSession(): void {
    this.proctoring.endSession();
  }

  toggleChat(): void {
    this.showChat = !this.showChat;
  }

  get statusLabel(): string {
    switch (this.state) {
      case 'live':
        return 'Live';
      case 'connecting':
        return 'Connecting…';
      case 'ended':
        return 'Session ended';
      case 'error':
        return 'Connection error';
      default:
        return 'Not started';
    }
  }
}
