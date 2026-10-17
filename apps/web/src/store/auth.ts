import { create } from "zustand";
import { TOKEN_KEY } from "../lib/api";

interface AuthState {
  token: string | null;
  email: string | null;
  setAuth: (token: string, email: string) => void;
  logout: () => void;
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: readStoredToken(),
  email: null,
  setAuth: (token, email) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // storage penuh/diblokir: sesi tetap berlaku di memori
    }
    set({ token, email });
  },
  logout: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // abaikan
    }
    set({ token: null, email: null });
  },
}));
