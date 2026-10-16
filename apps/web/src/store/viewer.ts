import { create } from "zustand";

interface ViewerState {
  lastModelId: string | null;
  setLastModelId: (id: string) => void;
}

export const useViewerStore = create<ViewerState>()((set) => ({
  lastModelId: null,
  setLastModelId: (id) => set({ lastModelId: id }),
}));
