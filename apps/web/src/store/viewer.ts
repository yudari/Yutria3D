import { create } from "zustand";

interface ViewerState {
  lastModelId: string | null;
  autoZoom: boolean;
  selectedDbIds: number[];
  setLastModelId: (id: string) => void;
  setAutoZoom: (value: boolean) => void;
  setSelectedDbIds: (ids: number[]) => void;
}

export const useViewerStore = create<ViewerState>()((set) => ({
  lastModelId: null,
  autoZoom: true,
  selectedDbIds: [],
  setLastModelId: (id) => set({ lastModelId: id }),
  setAutoZoom: (value) => set({ autoZoom: value }),
  setSelectedDbIds: (ids) => set({ selectedDbIds: ids }),
}));
