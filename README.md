# Valida — Smart Proctoring System (Angular)

A modular, standalone-component Angular 17 application ported from the supplied
`login.html` / `dashboard.html` / `notifications.html` templates, with JWT
authentication, guarded routing, WebRTC live video/screen feeds, and a
SignalR-powered live chat + alerts center.

## 1. Prerequisites

- Node.js 18.13+ (Node 20 LTS recommended)
- npm 9+
- Angular CLI 17 (`npm i -g @angular/cli`) — optional, `npx ng` also works

## 2. Install dependencies

```bash
cd valida-angular
npm install
```

This pulls in, among the standard Angular packages:

- `@microsoft/signalr` — the SignalR client used by `ChatService` and `AlertService`
- `rxjs`, `zone.js` — standard Angular runtime dependencies

## 3. Configure your backend endpoints

Edit `src/environments/environment.ts` (dev) and `environment.prod.ts` (prod):

```ts
export const environment = {
  production: false,
  apiBaseUrl: 'https://localhost:5001/api',   // REST API: /auth/login, /auth/signup, /auth/logout, /notifications
  chatHubUrl: 'https://localhost:5001/hubs/chat',      // SignalR hub for LiveChatComponent
  alertsHubUrl: 'https://localhost:5001/hubs/alerts',  // SignalR hub for AlertService
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
```

Expected REST contract (adjust `AuthService`/`AlertService` if yours differs):

| Method | Endpoint          | Body / Notes                                   |
|--------|-------------------|-------------------------------------------------|
| POST   | `/auth/login`     | `{ email, password, remember }` → `{ token, refreshToken?, user }` |
| POST   | `/auth/signup`    | `{ name, email, password, confirmPassword }` → `{ token, user }` |
| POST   | `/auth/logout`    | —                                               |
| GET    | `/notifications`  | → `AppNotification[]`                           |

Expected SignalR hub methods:

- **Chat hub** (`chatHubUrl`): client invokes `JoinSession(sessionId)` and
  `SendMessage(sessionId, text)`; server pushes `ReceiveMessage(message)`.
- **Alerts hub** (`alertsHubUrl`): server pushes `NewAlert(notification)`
  whenever a suspicious-activity flag or system event fires during a live exam.

## 4. Run locally

```bash
npm start
# → http://localhost:4200
```

Without a backend running, the app still works in **mock mode**:
- `AlertService.seedMockData()` populates the Dashboard/Notifications feeds.
- `ProctoringService.startMockSession()` (the "Simulate Feeds" button on the
  Live Proctoring page) opens your webcam if permitted, or falls back to an
  animated canvas stream, so the camera/screen UI can be fully exercised.
- `LiveChatComponent` falls back to echoing sent messages locally if the
  SignalR hub isn't reachable, so the chat UI still works end-to-end.

## 5. Build for production

```bash
npm run build:prod
# Output: dist/valida-proctoring/
```

## 6. Project structure

```
src/
├── app/
│   ├── app.component.ts        # Root shell (<router-outlet>)
│   ├── app.config.ts           # Providers: router, HttpClient + auth interceptor, animations
│   ├── app.routes.ts           # Route table + guards
│   ├── core/
│   │   ├── guards/auth.guard.ts        # authGuard (protects dashboard routes), guestGuard (login/signup)
│   │   ├── interceptors/auth.interceptor.ts  # attaches JWT, handles 401
│   │   ├── models/                     # User, Candidate, AppNotification, ChatMessage
│   │   └── services/
│   │       ├── auth.service.ts         # /login, /signup, /logout, token storage, auth state
│   │       ├── proctoring.service.ts   # WebRTC peer connection + mock feed fallback
│   │       ├── chat.service.ts         # SignalR chat hub wrapper
│   │       └── alert.service.ts        # SignalR alerts hub + notification history
│   ├── shared/components/navbar/       # Shared header/nav/profile-dropdown (dashboard.html header)
│   └── features/
│       ├── auth/
│       │   ├── login/                  # LoginComponent — ported from login.html
│       │   └── signup/                 # SignupComponent — new, matches login.css styling
│       ├── dashboard/                  # DashboardComponent — ported from dashboard.html
│       ├── live-proctoring/            # LiveProctoringComponent — WebRTC video/screen feeds
│       ├── live-chat/                  # LiveChatComponent — SignalR chat, embedded in Live Proctoring
│       └── notifications/              # NotificationsComponent — ported from notifications.html
├── assets/
│   ├── valida-logo.png
│   └── icons/fevicon.png
└── environments/
```

## 7. Notes on visual fidelity

- `css/login.css` and `css/dashboard.css` from the supplied ZIP were copied
  verbatim into the corresponding component stylesheets (`login.component.css`,
  `signup.component.css`, `dashboard.component.css`, `notifications.component.css`,
  `live-chat.component.css`, `live-proctoring.component.css`, `navbar.component.css`).
  A small number of rules were **appended** (never edited) to style elements that
  didn't exist in the static templates: the unread-count badge on the Alerts nav
  link, the live video/screen feed grid, the chat bubbles, and a "new message"
  flash animation.
- These components use `ViewEncapsulation.None` so the ported CSS (which
  targets global class names like `.card`, `.btn`, `.status-pill`) applies
  exactly as it did in the static HTML, without Angular's default style
  scoping getting in the way.

## 8. Wiring up real WebRTC signalling

`ProctoringService.startMockSession()` is a fallback for local development.
For a real candidate connection, use:

```ts
// When the candidate's SDP offer arrives over your signalling channel:
const answer = await proctoringService.handleRemoteOffer(offer);
// send `answer` back over the same channel

proctoringService.onLocalIceCandidate((candidate) => {
  // send `candidate` back over the same channel
});

// When a remote ICE candidate arrives:
await proctoringService.addRemoteIceCandidate(candidate);
```

Plug your signalling transport (SignalR is a natural fit, reusing the same
hub infrastructure as the chat feature) into these three calls.

---

## 7. Candidate exam flow, roles & admin (added)

**Roles** — `super_admin | admin | proctor | candidate` (API values are lower-cased on login). `roleGuard`
(`data: { roles: [...] }`) sends users to their own home (`AuthService.homeRoute()`). The guard is UX only; the API must enforce access.

| Role | Home | Routes |
|------|------|--------|
| candidate | `/candidate/exams` | `/candidate/exams/:id/instructions → system-check → start → result` |
| proctor | `/dashboard` | `/dashboard`, `/live-proctoring/:examId`, `/notifications` |
| admin / super_admin | `/admin/dashboard` | admin dashboard + the proctor console |

**Exam engine** — server-provided `startTime/endTime/serverTime` drive the timer (offset-corrected, auto-submit at 0),
question palette (5 states), mark for review, debounced auto-save with offline queue + retry, submit summary dialog.
Answer keys are never sent to the browser.

**Proctoring signals (browser-detectable only)** — fullscreen exit, tab hidden, window blur, copy/paste/cut/right-click,
camera/mic/screen track ended, offline/online. Events are de-duplicated (2 s), shown to the candidate and POSTed to
`/proctoring/events`. They are review signals, not proof of misconduct.

**Extra REST endpoints used**

| Method | Endpoint |
|--------|----------|
| GET | `/exams/assigned`, `/exams/:id`, `/exams/:id/questions`, `/exams/:id/result` |
| POST | `/exams/:id/sessions` → `{ id, examId, startTime, endTime, serverTime }` |
| PUT | `/sessions/:sid/answers/:questionId` |
| POST | `/sessions/:sid/submit`, `/proctoring/events` |
| GET | `/admin/stats`, `/admin/exams` |

**Demo mode** — `environment.demoMode` (true in dev, false in prod). When true and the API is unreachable, exam/admin screens use
`core/demo/demo-data.ts`. The demo result score is simulated. Sign-in still needs your API (or set a demo user in localStorage).

**Not yet implemented** — face detection / identity verification, candidate-side WebRTC offer + SignalR signalling and
`POST /webrtc/turn-credentials`, recording, admin CRUD (users, exams, question bank, reports, audit logs), unit/E2E tests, Docker.

**Build note** — `anyComponentStyle` budget raised to 50 kB/80 kB in `angular.json` because the ported theme CSS files are ~42 kB each.

**Demo sign-in** — with `demoMode: true` and no API running (connection refused), any valid email + 8-character password signs in locally.
Email containing `admin` -> admin, `candidate`/`student` -> candidate, otherwise proctor. Never enabled in production builds.
