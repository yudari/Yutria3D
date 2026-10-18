import { create } from "zustand";
import {
  BAHASA_KUNCI,
  bacaBahasaAwal,
  strings,
  type Bahasa,
  type KunciTeks,
} from "../i18n/translations";

interface BahasaState {
  bahasa: Bahasa;
  setBahasa: (b: Bahasa) => void;
  toggleBahasa: () => void;
}

function terapkan(bahasa: Bahasa): void {
  try {
    window.localStorage.setItem(BAHASA_KUNCI, bahasa);
  } catch {
    /* abaikan: bahasa tetap berlaku sesi ini */
  }
  try {
    document.documentElement.lang = bahasa;
  } catch {
    /* abaikan */
  }
}

try {
  document.documentElement.lang = bacaBahasaAwal();
} catch {
  /* abaikan saat SSR / non-DOM */
}

export const useBahasaStore = create<BahasaState>()((set, get) => ({
  bahasa: bacaBahasaAwal(),
  setBahasa: (bahasa) => {
    terapkan(bahasa);
    set({ bahasa });
  },
  toggleBahasa: () => {
    const lanjut: Bahasa = get().bahasa === "id" ? "en" : "id";
    terapkan(lanjut);
    set({ bahasa: lanjut });
  },
}));

export function useT(): (k: KunciTeks) => string {
  const bahasa = useBahasaStore((s) => s.bahasa);
  return (k: KunciTeks) => strings[bahasa][k];
}
