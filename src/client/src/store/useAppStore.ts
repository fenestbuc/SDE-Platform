import { create } from 'zustand';

interface AppState {
  isAuthenticated: boolean;
  username: string | null;
  isAdmin: boolean;
  worker: Worker | null;
  initWorker: () => void;
  login: (token: string, username: string, isAdmin: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isAuthenticated: !!sessionStorage.getItem('accessToken'),
  username: sessionStorage.getItem('username'),
  isAdmin: sessionStorage.getItem('isAdmin') === 'true',
  worker: null,
  
  initWorker: () => {
    if (get().worker) return;
    const worker = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), { type: 'module' });
    set({ worker });
  },
  
  login: (token, username, isAdmin) => {
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem('username', username);
    if (isAdmin) sessionStorage.setItem('isAdmin', 'true');
    set({ isAuthenticated: true, username, isAdmin });
  },
  
  logout: () => {
    sessionStorage.clear();
    set({ isAuthenticated: false, username: null, isAdmin: false });
  }
}));
