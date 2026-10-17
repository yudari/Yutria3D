import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchModelById } from "../lib/api";
import { useViewer, type ForgeViewer, type ViewableInfo } from "../hooks/useViewer";
import { useSelection } from "../hooks/useSelection";
import { useViewerStore } from "../store/viewer";

interface SimpulPohon {
  dbId: number;
  nama: string;
  anak: SimpulPohon[];
}

const DALAM = 3;

function bangunPohon(
  tree: Autodesk.Viewing.ObjectTree,
  dbId: number,
  nama: string,
  sisa: number,
): SimpulPohon {
  if (sisa <= 0) return { dbId, nama, anak: [] };
  const anak: SimpulPohon[] = [];
  try {
    const jumlah = tree.getChildCount(dbId);
    if (jumlah > 0) {
      tree.enumNodeChildren(dbId, (idAnak: number) => {
        let namaAnak = `#${idAnak}`;
        try {
          namaAnak = tree.getNodeName(idAnak);
        } catch {
          /* pakai fallback */
        }
        anak.push(bangunPohon(tree, idAnak, namaAnak, sisa - 1));
      });
    }
  } catch {
    /* kembalikan simpul daun bila enumerasi gagal */
  }
  return { dbId, nama, anak };
}

function BarisSimpul({
  simpul,
  viewer,
  level,
}: {
  simpul: SimpulPohon;
  viewer: ForgeViewer | null;
  level: number;
}): JSX.Element {
  const [buka, setBuka] = useState<boolean>(level < 1);
  const punyaAnak = simpul.anak.length > 0;

  function pilih(): void {
    if (viewer === null) return;
    try {
      viewer.select([simpul.dbId]);
      viewer.fitToView([simpul.dbId]);
    } catch {
      /* abaikan */
    }
  }

  return (
    <li>
      <div className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100">
        {punyaAnak ? (
          <button
            type="button"
            onClick={() => setBuka((v) => !v)}
            className="w-5 shrink-0 text-slate-500"
            aria-label={buka ? "Tutup" : "Buka"}
          >
            {buka ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={pilih}
          className="min-w-0 flex-1 truncate text-left text-sm"
          title={simpul.nama}
        >
          {simpul.nama}
        </button>
      </div>
      {punyaAnak && buka && (
        <ul className="ml-4 border-l border-slate-200 pl-1">
          {simpul.anak.map((a) => (
            <BarisSimpul key={a.dbId} simpul={a} viewer={viewer} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function labelStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "success":
      return "Siap";
    case "failed":
      return "Gagal";
    case "timeout":
      return "Kedaluwarsa";
    case "pending":
      return "Menunggu antrean";
    case "inprogress":
    case "in_progress":
    case "processing":
      return "Menerjemahkan";
    default:
      return status;
  }
}

export default function ViewerPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const setLastModelId = useViewerStore((s) => s.setLastModelId);

  const modelQuery = useQuery({
    queryKey: ["model", id],
    queryFn: () => fetchModelById(id ?? ""),
    enabled: typeof id === "string" && id.length > 0,
    refetchInterval: (q) => {
      const s = q.state.data?.status.toLowerCase();
      return s === undefined || (s !== "success" && s !== "failed" && s !== "timeout")
        ? 4000
        : false;
    },
  });

  useEffect(() => {
    if (id) setLastModelId(id);
  }, [id, setLastModelId]);

  const urn = useMemo(
    () => (modelQuery.data && modelQuery.data.urn.length > 0 ? modelQuery.data.urn : ""),
    [modelQuery.data],
  );
  const siap = (modelQuery.data?.status.toLowerCase() ?? "") === "success" && urn.length > 0;
  const penampil = useViewer(siap ? urn : "");
  const viewer = siap ? penampil.viewer : null;
  const { dbIdTerpilih, autoZoom, setAutoZoom, aturUlang } =
    useSelection(viewer);

  const [panelBuka, setPanelBuka] = useState<boolean>(true);
  const [pohon, setPohon] = useState<SimpulPohon[]>([]);
  const [kunciCari, setKunciCari] = useState<string>("");
  const [hasilCari, setHasilCari] = useState<number[]>([]);
  const [mencari, setMencari] = useState<boolean>(false);
  const [properti, setProperti] = useState<
    Autodesk.Viewing.PropertyValue[]
  >([]);
  const [namaTerpilih, setNamaTerpilih] = useState<string>("");
  const [memotret, setMemotret] = useState<boolean>(false);

  useEffect(() => {
    setPohon([]);
    setHasilCari([]);
    setProperti([]);
    setNamaTerpilih("");
    if (viewer === null) return;
    let batal = false;
    try {
      viewer.getObjectTree(
        (tree) => {
          if (batal) return;
          let akar = 0;
          let namaAkar = "Model";
          try {
            akar = tree.getRootId();
            namaAkar = tree.getNodeName(akar);
          } catch {
            /* pakai default */
          }
          setPohon([bangunPohon(tree, akar, namaAkar, DALAM)]);
        },
        () => {
          /* pohon opsional; panel tetap berfungsi */
        },
      );
    } catch {
      /* abaikan */
    }
    return () => {
      batal = true;
    };
  }, [viewer]);

  useEffect(() => {
    setProperti([]);
    setNamaTerpilih("");
    if (viewer === null || dbIdTerpilih.length === 0) return;
    const target = dbIdTerpilih[0] as number;
    let batal = false;
    try {
      viewer.getProperties(
        target,
        (hasil) => {
          if (batal) return;
          setNamaTerpilih(hasil.name);
          setProperti(Array.isArray(hasil.properties) ? hasil.properties : []);
        },
        () => {
          /* properti opsional */
        },
      );
    } catch {
      /* abaikan */
    }
    return () => {
      batal = true;
    };
  }, [viewer, dbIdTerpilih]);

  function cari(): void {
    if (viewer === null || kunciCari.trim().length === 0) return;
    setMencari(true);
    try {
      viewer.search(
        kunciCari.trim(),
        (ids) => {
          setHasilCari(ids.filter((n) => Number.isInteger(n)));
          setMencari(false);
        },
        () => setMencari(false),
      );
    } catch {
      setMencari(false);
    }
  }

  function pilihHasil(dbId: number): void {
    if (viewer === null) return;
    try {
      viewer.select([dbId]);
      viewer.fitToView([dbId]);
    } catch {
      /* abaikan */
    }
  }

  function isolasiTerpilih(): void {
    if (viewer === null) return;
    try {
      if (dbIdTerpilih.length > 0) viewer.isolate(dbIdTerpilih);
    } catch {
      /* abaikan */
    }
  }

  function sembunyiTerpilih(): void {
    if (viewer === null) return;
    try {
      if (dbIdTerpilih.length > 0) viewer.hide(dbIdTerpilih);
    } catch {
      /* abaikan */
    }
  }

  function tampilSemua(): void {
    if (viewer === null) return;
    try {
      viewer.showAll();
    } catch {
      /* abaikan */
    }
  }

  function potret(): void {
    if (viewer === null) return;
    setMemotret(true);
    try {
      const url = viewer.getScreenshot();
      if (typeof url === "string" && url.length > 0) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `yutria3d-${id ?? "model"}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      /* abaikan */
    } finally {
      setMemotret(false);
    }
  }

  const pemilih: ViewableInfo[] = penampil.viewables;
  return (
    <main className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Link to="/models" className="text-sm text-blue-600 hover:underline">
          &larr; Kembali
        </Link>
        <h1 className="truncate text-lg font-bold">
          {modelQuery.data ? modelQuery.data.name : `Model ${id ?? ""}`}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelBuka((v) => !v)}
            className="rounded border px-3 py-1 text-sm hover:bg-slate-50"
          >
            {panelBuka ? "Sembunyikan panel" : "Tampilkan panel"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1 bg-slate-900">
          {modelQuery.isLoading && (
            <p className="absolute inset-0 flex items-center justify-center text-slate-200">
              Memuat info model…
            </p>
          )}
          {modelQuery.isError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-200">
              <p>Gagal memuat model.</p>
              <Link to="/models" className="text-sm text-blue-300 hover:underline">
                Kembali ke Models
              </Link>
            </div>
          )}
          {modelQuery.data && !siap && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-200">
              <p>
                Status: {labelStatus(modelQuery.data.status)} (
                {modelQuery.data.progress}%)
              </p>
              <p className="text-sm text-slate-400">
                Model masih diterjemahkan. Halaman memuat ulang otomatis.
              </p>
              <Link to="/models" className="text-sm text-blue-300 hover:underline">
                Kembali ke Models
              </Link>
            </div>
          )}
          {siap && penampil.error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-200">
              <p>{penampil.error}</p>
            </div>
          )}
          {siap && penampil.loading && !penampil.error && (
            <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-sm text-slate-200">
              Memuat viewer…
            </p>
          )}
          {siap && <div ref={penampil.containerRef} className="h-full w-full" />}
        </section>

        {panelBuka && (
          <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-white p-4">
            <section>
              <h2 className="text-sm font-semibold">Tampilan</h2>
              {pemilih.length <= 1 ? (
                <p className="mt-1 text-sm text-slate-500">
                  {pemilih[0] ? pemilih[0].name : "Satu tampilan tersedia."}
                </p>
              ) : (
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={penampil.currentGuid ?? ""}
                  onChange={(e) => penampil.selectView(e.target.value)}
                >
                  {pemilih.map((v) => (
                    <option key={v.guid} value={v.guid}>
                      {v.role === "2d" ? "2D" : "3D"} — {v.name}
                    </option>
                  ))}
                </select>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold">Cari objek</h2>
              <div className="mt-1 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                  value={kunciCari}
                  onChange={(e) => setKunciCari(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") cari();
                  }}
                  placeholder="Kata kunci…"
                />
                <button
                  type="button"
                  onClick={cari}
                  disabled={mencari || viewer === null}
                  className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {mencari ? "…" : "Cari"}
                </button>
              </div>
              {hasilCari.length > 0 && (
                <ul className="mt-2 max-h-32 overflow-y-auto rounded border p-1">
                  {hasilCari.slice(0, 50).map((dbId) => (
                    <li key={dbId}>
                      <button
                        type="button"
                        onClick={() => pilihHasil(dbId)}
                        className="w-full truncate rounded px-1 py-0.5 text-left text-sm hover:bg-slate-100"
                      >
                        #{dbId}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold">Struktur model</h2>
              {pohon.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">
                  Struktur belum tersedia.
                </p>
              ) : (
                <ul className="mt-1 max-h-56 overflow-y-auto">
                  {pohon.map((s) => (
                    <BarisSimpul key={s.dbId} simpul={s} viewer={viewer} level={0} />
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold">Tindakan</h2>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={isolasiTerpilih}
                  disabled={dbIdTerpilih.length === 0}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Isolasi
                </button>
                <button
                  type="button"
                  onClick={sembunyiTerpilih}
                  disabled={dbIdTerpilih.length === 0}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Sembunyi
                </button>
                <button
                  type="button"
                  onClick={tampilSemua}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
                >
                  Tampilkan semua
                </button>
                <button
                  type="button"
                  onClick={potret}
                  disabled={memotret || viewer === null}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {memotret ? "…" : "Simpan PNG"}
                </button>
                <button
                  type="button"
                  onClick={aturUlang}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
                >
                  Atur ulang
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoZoom}
                  onChange={(e) => setAutoZoom(e.target.checked)}
                />
                Zoom otomatis ke pilihan
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Pintasan: Esc hapus pilihan · F bingkai pilihan · H beranda
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold">Properti</h2>
              {dbIdTerpilih.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">
                  Belum ada objek terpilih.
                </p>
              ) : properti.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">
                  {namaTerpilih || `Objek #${dbIdTerpilih[0]}`} — properti tidak
                  tersedia.
                </p>
              ) : (
                <dl className="mt-1 max-h-64 overflow-y-auto rounded border p-2 text-sm">
                  <dt className="font-medium">{namaTerpilih}</dt>
                  {properti.map((p, i) => (
                    <div key={`${p.displayName}-${i}`} className="mt-1">
                      <dt className="text-xs text-slate-500">
                        {p.displayCategory} · {p.displayName}
                      </dt>
                      <dd className="break-words">{String(p.displayValue)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </aside>
        )}
      </div>
    </main>
  );
}
