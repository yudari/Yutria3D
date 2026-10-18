import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchModelById } from "../lib/api";
import { useViewer, type ForgeViewer, type ViewableInfo } from "../hooks/useViewer";
import { useSelection } from "../hooks/useSelection";
import { useViewerStore } from "../store/viewer";
import { strings, type KunciTeks } from "../i18n/translations";
import { useBahasaStore } from "../store/bahasa";

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
  const bahasa = useBahasaStore((s) => s.bahasa);
  const t = (k: KunciTeks): string => strings[bahasa][k];

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
            aria-label={buka ? t("viewerTutup") : t("viewerBuka")}
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
  let bahasa: "id" | "en" = "id";
  try {
    bahasa = window.localStorage.getItem("yutria3d-bahasa") === "en" ? "en" : "id";
  } catch {
    bahasa = "id";
  }
  const t = (k: KunciTeks): string => strings[bahasa][k];
  switch (status.toLowerCase()) {
    case "success":
      return t("statusSiap");
    case "failed":
      return t("statusGagal");
    case "timeout":
      return t("statusKedaluwarsa");
    case "pending":
      return t("statusAntre");
    case "inprogress":
    case "in_progress":
    case "processing":
      return t("statusTerjemah");
    default:
      return status;
  }
}

export default function ViewerPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const setLastModelId = useViewerStore((s) => s.setLastModelId);
  const bahasa = useBahasaStore((s) => s.bahasa);
  const t = (k: KunciTeks): string => strings[bahasa][k];

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
  const [perspektif, setPerspektif] = useState<boolean>(true);
  const [tampilGaris, setTampilGaris] = useState<boolean>(false);
  const [latarGelap, setLatarGelap] = useState<boolean>(true);

  function gantiProyeksi(): void {
    if (viewer === null) return;
    try {
      if (perspektif) viewer.navigation.toOrthographic();
      else viewer.navigation.toPerspective();
      setPerspektif((v) => !v);
    } catch {
      /* abaikan: tombol tetap pada keadaan semula */
    }
  }

  function gantiGarisTepi(): void {
    if (viewer === null) return;
    try {
      viewer.setDisplayEdges(!tampilGaris);
      setTampilGaris((v) => !v);
    } catch {
      /* abaikan */
    }
  }

  function gantiLatar(): void {
    if (viewer === null) return;
    try {
      if (latarGelap) {
        viewer.setTheme("light-theme");
        viewer.setEnvMapBackground(false);
        viewer.setBackgroundColor(235, 235, 235, 220, 220, 220);
      } else {
        viewer.setTheme("dark-theme");
        viewer.setEnvMapBackground(true);
        viewer.setBackgroundColor(20, 28, 38, 10, 15, 25);
      }
      setLatarGelap((v) => !v);
    } catch {
      /* abaikan */
    }
  }

  function layarPenuh(): void {
    const wadah = penampil.containerRef.current;
    if (!wadah) return;
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void wadah.requestFullscreen();
      }
    } catch {
      /* abaikan: fullscreen opsional */
    }
  }
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
          let namaAkar = t("viewerAkar");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        a.download = `yutria3d-${id ?? "file-3d"}.png`;
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
        <Link
          to="/models"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {t("viewerKembali")}
        </Link>
        <h1 className="truncate text-lg font-bold">
          {modelQuery.data ? modelQuery.data.name : (id ?? "")}
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={gantiProyeksi}
            disabled={viewer === null}
            title={t("viewerGantiProyeksi")}
            className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {perspektif ? t("viewerOrtografik") : t("viewerPerspektif")}
          </button>
          <button
            type="button"
            onClick={gantiGarisTepi}
            disabled={viewer === null}
            aria-pressed={tampilGaris}
            title={t("viewerGaris")}
            className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {tampilGaris ? "Shaded" : "Wireframe"}
          </button>
          <button
            type="button"
            onClick={gantiLatar}
            disabled={viewer === null}
            title={t("viewerLatar")}
            className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {latarGelap ? t("viewerLatarTerang") : t("viewerLatarGelap")}
          </button>
          <button
            type="button"
            onClick={layarPenuh}
            disabled={!siap}
            title={t("viewerPenuhJudul")}
            className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {t("viewerPenuh")}
          </button>
          <button
            type="button"
            onClick={() => setPanelBuka((v) => !v)}
            className="rounded border px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {panelBuka ? t("viewerSembunyiPanel") : t("viewerTampilPanel")}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1 bg-slate-900">
          {modelQuery.isLoading && (
            <p className="absolute inset-0 flex items-center justify-center text-slate-200">
              {t("viewerMemuatInfo")}
            </p>
          )}
          {modelQuery.isError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-200">
              <p>{t("viewerGagalMuat")}</p>
              <Link to="/models" className="text-sm text-blue-300 hover:underline">
                {t("viewerKembaliKe")}
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
                {t("viewerMasihTerjemah")}
              </p>
              <Link to="/models" className="text-sm text-blue-300 hover:underline">
                {t("viewerKembaliKe")}
              </Link>
            </div>
          )}
          {siap && penampil.error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-slate-200">
              <p>{penampil.error}</p>
              <button
                type="button"
                onClick={penampil.reload}
                className="rounded border border-slate-500 px-4 py-1.5 text-sm hover:bg-slate-800"
              >
                {t("viewerMuatUlang")}
              </button>
            </div>
          )}
          {siap && penampil.loading && !penampil.error && (
            <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-sm text-slate-200">
              {t("viewerMemuatViewer")}
            </p>
          )}
          {siap && <div ref={penampil.containerRef} className="h-full w-full" />}
        </section>

        {panelBuka && (
          <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-white p-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <section>
              <h2 className="text-sm font-semibold">{t("viewerTampilan")}</h2>
              {pemilih.length <= 1 ? (
                <p className="mt-1 text-sm text-slate-500">
                  {pemilih[0] ? pemilih[0].name : t("viewerSatuTampilan")}
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
              <h2 className="text-sm font-semibold">{t("viewerCariObjek")}</h2>
              <div className="mt-1 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                  value={kunciCari}
                  onChange={(e) => setKunciCari(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") cari();
                  }}
                  placeholder={t("viewerKataKunci")}
                />
                <button
                  type="button"
                  onClick={cari}
                  disabled={mencari || viewer === null}
                  className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {mencari ? "…" : t("viewerCari")}
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
              <h2 className="text-sm font-semibold">{t("viewerStruktur")}</h2>
              {pohon.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">
                  {t("viewerStrukturKosong")}
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
              <h2 className="text-sm font-semibold">{t("viewerTindakan")}</h2>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={isolasiTerpilih}
                  disabled={dbIdTerpilih.length === 0}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {t("viewerIsolasi")}
                </button>
                <button
                  type="button"
                  onClick={sembunyiTerpilih}
                  disabled={dbIdTerpilih.length === 0}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {t("viewerSembunyi")}
                </button>
                <button
                  type="button"
                  onClick={tampilSemua}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
                >
                  {t("viewerTampilSemua")}
                </button>
                <button
                  type="button"
                  onClick={potret}
                  disabled={memotret || viewer === null}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {memotret ? "…" : t("viewerSimpanPng")}
                </button>
                <button
                  type="button"
                  onClick={aturUlang}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
                >
                  {t("viewerAturUlang")}
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoZoom}
                  onChange={(e) => setAutoZoom(e.target.checked)}
                />
                {t("viewerZoomOtomatis")}
              </label>
              <p className="mt-1 text-xs text-slate-500">
                {t("viewerPintasan")}
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold">{t("viewerProperti")}</h2>
              {dbIdTerpilih.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("viewerBelumPilih")}
                </p>
              ) : properti.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {namaTerpilih || `Objek #${dbIdTerpilih[0]}`} — {t("viewerPropertiKosong")}
                </p>
              ) : (
                <div className="mt-1 overflow-hidden rounded border dark:border-slate-600">
                  <p className="border-b bg-slate-50 px-2 py-1 text-sm font-medium dark:border-slate-600 dark:bg-slate-800">
                    {namaTerpilih || `Objek #${dbIdTerpilih[0]}`}
                  </p>
                  <table className="max-h-64 w-full overflow-y-auto text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        <th className="px-2 py-1 font-medium">{t("viewerKategori")}</th>
                        <th className="px-2 py-1 font-medium">{t("viewerNama")}</th>
                        <th className="px-2 py-1 font-medium">{t("viewerNilai")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {properti.map((p, i) => (
                        <tr
                          key={`${p.displayCategory}-${p.displayName}-${i}`}
                          className="border-b last:border-0 dark:border-slate-700"
                        >
                          <td className="px-2 py-1 align-top text-xs text-slate-500 dark:text-slate-400">
                            {p.displayCategory}
                          </td>
                          <td className="px-2 py-1 align-top">
                            {p.displayName}
                          </td>
                          <td className="break-words px-2 py-1 align-top">
                            {String(p.displayValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </aside>
        )}
      </div>
    </main>
  );
}
