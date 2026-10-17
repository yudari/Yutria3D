import { useCallback, useEffect, useRef, useState } from "react";
import { fetchViewerToken } from "../lib/api";

export type ForgeViewer = Autodesk.Viewing.GuiViewer3D;

export interface ViewableInfo {
  guid: string;
  name: string;
  role: string;
}

const VIEWER_BASE =
  "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.120";
const VIEWER_CSS = `${VIEWER_BASE}/style.min.css`;
const VIEWER_JS = `${VIEWER_BASE}/viewer3D.min.js`;

let viewerAssetsPromise: Promise<void> | null = null;

function loadViewerAssets(): Promise<void> {
  if (typeof window !== "undefined" && window.Autodesk?.Viewing) {
    return Promise.resolve();
  }
  if (viewerAssetsPromise) return viewerAssetsPromise;
  viewerAssetsPromise = new Promise<void>((resolve, reject) => {
    const css = document.querySelector<HTMLLinkElement>(
      `link[data-forge-viewer]`,
    );
    if (!css) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = VIEWER_CSS;
      link.dataset.forgeViewer = "css";
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-forge-viewer]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Gagal memuat APS Viewer.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = VIEWER_JS;
    script.async = true;
    script.dataset.forgeViewer = "js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat APS Viewer."));
    document.body.appendChild(script);
  });
  return viewerAssetsPromise;
}

/** Initializer sekali per sesi; pemanggilan ulang tidak mengulang handshake token. */
let viewerInitPromise: Promise<void> | null = null;

function initializeViewer(): Promise<void> {
  if (viewerInitPromise) return viewerInitPromise;
  viewerInitPromise = new Promise<void>((resolve, reject) => {
    try {
      window.Autodesk?.Viewing.Initializer(
        {
          env: "AutodeskProduction2",
          api: "streamingV2",
          getAccessToken: (onToken) => {
            fetchViewerToken()
              .then((t) => onToken(t.accessToken, t.expiresIn))
              .catch(() => undefined);
          },
        },
        () => resolve(),
      );
    } catch (err) {
      viewerInitPromise = null;
      reject(err instanceof Error ? err : new Error("Inisialisasi gagal."));
    }
  });
  return viewerInitPromise;
}

function collectViewables(
  doc: Autodesk.Viewing.ForgeDocument,
): Autodesk.Viewing.ViewableNode[] {
  const root = doc.getRoot();
  const found = root.search({ type: "geometry" });
  if (found.length > 0) return found;
  const fallback = root.getDefaultGeometry();
  return fallback ? [fallback] : [];
}

const EKSTENSI_STANDAR: string[] = [
  "Autodesk.Measure",
  "Autodesk.Section",
  "Autodesk.Explode",
];

/** Muat ekstensi standar; kegagalan non-fatal, hanya peringatan konsol. */
function muatEkstensiStandar(viewer: ForgeViewer): void {
  for (const id of EKSTENSI_STANDAR) {
    try {
      viewer.loadExtension(id).then(undefined, () => {
        console.warn(`Ekstensi viewer ${id} gagal dimuat.`);
      });
    } catch {
      console.warn(`Ekstensi viewer ${id} gagal dimuat.`);
    }
  }
}

function toViewableInfo(v: Autodesk.Viewing.ViewableNode): ViewableInfo {
  let role = "3d";
  if (v.data && typeof v.data === "object" && "role" in v.data) {
    const r = v.data.role;
    if (typeof r === "string" && r.length > 0) role = r;
  }
  return { guid: v.guid(), name: v.name() ?? v.guid(), role };
}

/** Pesan galat Autodesk yang ramah untuk pengguna. */
function pesanGalatMuat(kode: number, pesan: string): string {
  if (kode === 404)
    return "File 3D belum tersedia di Autodesk atau tautannya kedaluwarsa. Coba Muat ulang; bila tetap, unggah ulang file.";
  if (kode === 401 || kode === 403)
    return "Sesi tampilan kedaluwarsa. Coba Muat ulang.";
  if (pesan.length > 0) return `Gagal memuat file 3D: ${pesan}`;
  return "Gagal memuat file 3D.";
}

export interface UseViewerResult {
  containerRef: React.RefObject<HTMLDivElement>;
  viewer: ForgeViewer | null;
  viewables: ViewableInfo[];
  currentGuid: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  selectView: (guid: string) => void;
}

export function useViewer(urn: string): UseViewerResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ForgeViewer | null>(null);
  const docRef = useRef<Autodesk.Viewing.ForgeDocument | null>(null);
  const nodesRef = useRef<Autodesk.Viewing.ViewableNode[]>([]);
  const cancelledRef = useRef(false);
  const [viewer, setViewer] = useState<ForgeViewer | null>(null);
  const [viewables, setViewables] = useState<ViewableInfo[]>([]);
  const [currentGuid, setCurrentGuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upaya, setUpaya] = useState(0);

  const reload = useCallback(() => setUpaya((u) => u + 1), []);

  const selectView = useCallback((guid: string) => {
    const v = viewerRef.current;
    const doc = docRef.current;
    if (!v || !doc || cancelledRef.current) return;
    const node = nodesRef.current.find((n) => n.guid() === guid);
    if (!node) return;
    setLoading(true);
    v.loadDocumentNode(doc, node)
      .then(() => {
        if (!cancelledRef.current) {
          setCurrentGuid(guid);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelledRef.current) {
          setError("Gagal memuat tampilan.");
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (urn.length === 0) {
      // Belum ada URN (data model masih dimuat): jangan sentuh Autodesk sama sekali.
      setLoading(true);
      setError(null);
      return;
    }
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setViewer(null);
    setViewables([]);
    setCurrentGuid(null);
    viewerRef.current = null;
    docRef.current = null;
    nodesRef.current = [];

    let activeViewer: ForgeViewer | null = null;

    loadViewerAssets()
      .then(() => initializeViewer())
      .then(
        () =>
          new Promise<Autodesk.Viewing.ForgeDocument>((resolve, reject) => {
            const AutodeskNs = window.Autodesk?.Viewing;
            if (!AutodeskNs) {
              reject(new Error("APS Viewer tidak tersedia."));
              return;
            }
            AutodeskNs.Document.load(
              urn.startsWith("urn:") ? urn : `urn:${urn}`,
              (doc) => resolve(doc),
              (kode, msg) =>
                reject(new Error(pesanGalatMuat(kode, msg ?? ""))),
            );
          }),
      )
      .then((doc) => {
        if (cancelledRef.current) return;
        const container = containerRef.current;
        if (!container) throw new Error("Kontainer viewer tidak tersedia.");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const AutodeskNs = window.Autodesk!.Viewing;
        docRef.current = doc;
        const nodes = collectViewables(doc);
        nodesRef.current = nodes;
        const infos = nodes.map(toViewableInfo);
        const preferred =
          infos.find((i) => i.role === "3d") ?? infos[0] ?? null;
        const v = new AutodeskNs.GuiViewer3D(container);
        const started = v.start();
        if (started !== 0)
          throw new Error("Viewer gagal dijalankan.");
        activeViewer = v;
        viewerRef.current = v;
        muatEkstensiStandar(v);
        if (preferred) {
          const node =
            nodes.find((n) => n.guid() === preferred.guid) ?? null;
          if (node) {
            return v
              .loadDocumentNode(doc, node)
              .then(() => {
                if (cancelledRef.current) {
                  v.finish();
                  return;
                }
                setViewer(v);
                setViewables(infos);
                setCurrentGuid(preferred.guid);
                setLoading(false);
              });
          }
        }
        setViewer(v);
        setViewables(infos);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelledRef.current) return;
        setError(
          err instanceof Error ? err.message : "Viewer gagal dimuat.",
        );
        setLoading(false);
      });

    return () => {
      cancelledRef.current = true;
      if (activeViewer) {
        try {
          activeViewer.finish();
        } catch {
          // Abaikan error cleanup.
        }
        activeViewer = null;
      }
      viewerRef.current = null;
      docRef.current = null;
      nodesRef.current = [];
      const container = containerRef.current;
      if (container) container.innerHTML = "";
    };
  }, [urn, upaya]);

  return {
    containerRef,
    viewer,
    viewables,
    currentGuid,
    loading,
    error,
    reload,
    selectView,
  };
}
