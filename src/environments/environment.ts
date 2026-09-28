export const environment = {
  production: false,
  // When true and the API is unreachable, exam/admin screens fall back to built-in demo data.
  demoMode: true,
  // Base URL for the REST API (login/signup/logout/candidates/etc.)
  apiBaseUrl: 'https://localhost:5001/api',
  // SignalR hub endpoint for the live chat feature
  chatHubUrl: 'https://localhost:5001/hubs/chat',
  // SignalR hub endpoint for alerts / notifications pushed during live exams
  alertsHubUrl: 'https://localhost:5001/hubs/alerts',
  // Optional TURN/STUN servers for WebRTC NAT traversal
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
