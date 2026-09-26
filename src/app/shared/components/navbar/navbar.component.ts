import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Shared top navigation bar used by the Dashboard, Notifications, and
 * Live Proctoring pages. Ported from the header markup shared by
 * dashboard.html / notifications.html, including the profile dropdown
 * and mobile hamburger menu behaviour.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private elementRef = inject(ElementRef);

  @Input() unreadCount = 0;
  @Output() unreadCountChange = new EventEmitter<number>();

  profileMenuOpen = false;
  mobileNavOpen = false;

  get currentUser() {
    return this.auth.currentUser;
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  closeMobileNav(): void {
    this.mobileNavOpen = false;
  }

  logout(): void {
    this.closeProfileMenu();
    this.auth.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.profileMenuOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeProfileMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeProfileMenu();
  }
}
