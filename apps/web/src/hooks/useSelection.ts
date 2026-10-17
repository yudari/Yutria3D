import { useEffect } from "react";
import { useViewerStore } from "../store/viewer";
import type { ForgeViewer } from "./useViewer";

export interface HasilSeleksi {
  dbIdTerpilih: number[];
  autoZoom: boolean;
  setAutoZoom: (nilai: boolean) => void;
  aturUlang: () => void;
}

/** Minta transisi kamera yang halus bila API-nya tersedia; abaikan bila tidak. */
function transisiHalus(viewer: ForgeViewer): void {
  const kandidat: unknown = viewer;
  if (kandidat === null || typeof kandidat !== "object") return;
  if (!("navigation" in kandidat)) return;
  const nav: unknown = kandidat.navigation;
  if (nav === null || typeof nav !== "object") return;
  if (!("setRequestTransition" in nav)) return;
  const minta: unknown = nav.setRequestTransition;
  if (typeof minta !== "function") return;
  try {
    const mintaTransisi: (aktif: boolean) => void = minta as (
      aktif: boolean,
    ) => void;
    mintaTransisi.call(nav, true);
  } catch {
    /* abaikan: transisi hanya peningkatan visual */
  }
}

function bingkai(viewer: ForgeViewer, ids?: number[]): void {
  transisiHalus(viewer);
  try {
    viewer.fitToView(ids);
  } catch {
    /* abaikan: pilihan tetap tersimpan walau zoom gagal */
  }
}

function targetAdalahIsian(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

/**
 * Melacak SELECTION_CHANGED_EVENT viewer ke store, zoom otomatis opsional
 * ke pilihan, dan pintasan keyboard: Esc = hapus pilihan, F = bingkai
 * pilihan, H = beranda. Toggle autoZoom default menyala dari store.
 */
export function useSelection(viewer: ForgeViewer | null): HasilSeleksi {
  const autoZoom = useViewerStore((s) => s.autoZoom);
  const setAutoZoom = useViewerStore((s) => s.setAutoZoom);
  const dbIdTerpilih = useViewerStore((s) => s.selectedDbIds);
  const setDbIdTerpilih = useViewerStore((s) => s.setSelectedDbIds);

  useEffect(() => {
    if (viewer === null) {
      setDbIdTerpilih([]);
      return;
    }
    const pendengar = (ev: Autodesk.Viewing.SelectionChangedPayload): void => {
      const mentah = Array.isArray(ev.dbIdArray) ? ev.dbIdArray : [];
      const ids = mentah.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n),
      );
      setDbIdTerpilih(ids);
      if (autoZoom && ids.length > 0) bingkai(viewer, ids);
    };
    viewer.addEventListener(
      Autodesk.Viewing.SELECTION_CHANGED_EVENT,
      pendengar,
    );
    return () => {
      viewer.removeEventListener(
        Autodesk.Viewing.SELECTION_CHANGED_EVENT,
        pendengar,
      );
    };
  }, [viewer, autoZoom, setDbIdTerpilih]);

  useEffect(() => {
    if (viewer === null) return;
    const padaTombol = (e: KeyboardEvent): void => {
      if (targetAdalahIsian(e.target)) return;
      if (e.key === "Escape") {
        try {
          viewer.clearSelection();
        } catch {
          /* abaikan */
        }
      } else if (e.key === "f" || e.key === "F") {
        const ids = viewer.getSelection();
        if (ids.length > 0) bingkai(viewer, ids);
      } else if (e.key === "h" || e.key === "H") {
        bingkai(viewer);
      }
    };
    window.addEventListener("keydown", padaTombol);
    return () => {
      window.removeEventListener("keydown", padaTombol);
    };
  }, [viewer]);

  return {
    dbIdTerpilih,
    autoZoom,
    setAutoZoom,
    aturUlang: () => {
      if (viewer !== null) {
        try {
          viewer.clearSelection();
        } catch {
          /* abaikan */
        }
        bingkai(viewer);
      }
      setDbIdTerpilih([]);
    },
  };
}
