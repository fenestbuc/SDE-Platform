import { create } from 'zustand';

interface AppState {
  isAuthenticated: boolean;
  username: string | null;
  isAdmin: boolean;
  worker: Worker | null;
  ws: WebSocket | null;
  initWorker: () => void;
  connectWs: () => void;
  login: (token: string, username: string, isAdmin: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isAuthenticated: !!sessionStorage.getItem('accessToken'),
  username: sessionStorage.getItem('username'),
  isAdmin: sessionStorage.getItem('isAdmin') === 'true',
  worker: null,
  ws: null,
  
  initWorker: () => {
    if (get().worker) return;
    const worker = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), { type: 'module' });
    set({ worker });
  },

  connectWs: () => {
    const token = sessionStorage.getItem('accessToken');
    if (!token || get().ws) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'new_message') {
          // Could trigger a reload or toast here
          window.dispatchEvent(new CustomEvent('ws:new_message', { detail: msg }));
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      set({ ws: null });
      // Reconnect after 3 seconds
      if (get().isAuthenticated) {
        setTimeout(() => get().connectWs(), 3000);
      }
    };

    set({ ws });
  },
  
  login: (token, username, isAdmin) => {
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem('username', username);
    if (isAdmin) sessionStorage.setItem('isAdmin', 'true');
    set({ isAuthenticated: true, username, isAdmin });
    get().connectWs();
  },
  
  logout: () => {
    sessionStorage.clear();
    const ws = get().ws;
    if (ws) {
      ws.close();
    }
    set({ isAuthenticated: false, username: null, isAdmin: false, ws: null });
  }
}));
