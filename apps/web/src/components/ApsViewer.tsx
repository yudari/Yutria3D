import { useEffect } from "react";
import { useViewer, type ForgeViewer } from "../hooks/useViewer";

export interface ApsViewerProps {
  urn: string;
  onViewerReady?: (viewer: ForgeViewer) => void;
  onSelectionChange?: (dbIds: number[]) => void;
}

export default function ApsViewer({
  urn,
  onViewerReady,
  onSelectionChange,
}: ApsViewerProps): JSX.Element {
  const { containerRef, viewer, loading, error } = useViewer(urn);

  useEffect(() => {
    if (viewer && onViewerReady) onViewerReady(viewer);
  }, [viewer, onViewerReady]);

  useEffect(() => {
    if (!viewer) return;
    const AutodeskNs = window.Autodesk?.Viewing;
    if (!AutodeskNs) return;
    const listener = (event: Autodesk.Viewing.SelectionChangedPayload) => {
      if (onSelectionChange) onSelectionChange(event.dbIdArray ?? []);
    };
    viewer.addEventListener(AutodeskNs.SELECTION_CHANGED_EVENT, listener);
    return () => {
      viewer.removeEventListener(AutodeskNs.SELECTION_CHANGED_EVENT, listener);
    };
  }, [viewer, onSelectionChange]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <p className="text-sm text-slate-600">Memuat file 3D…</p>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
