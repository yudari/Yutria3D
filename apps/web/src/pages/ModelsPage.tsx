import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  deleteModel,
  fetchModels,
  fetchStatus,
  uploadModel,
  uploadSample,
  type ModelDto,
  type StatusDto,
} from "../lib/api";
import { format, strings, type KunciTeks } from "../i18n/translations";
import { useBahasaStore } from "../store/bahasa";

interface ModelTampil extends ModelDto {
  failureMessage?: string | null;
}

const STATUS_AKTIF = ["pending", "inprogress", "in_progress", "processing"];

function tSync(k: KunciTeks): string {
  let bahasa: "id" | "en" = "id";
  try {
    bahasa =
      window.localStorage.getItem("yutria3d-bahasa") === "en" ? "en" : "id";
  } catch {
    bahasa = "id";
  }
  return strings[bahasa][k];
}

/** Daftar model + status translation live dari APS untuk yang masih aktif. */
async function fetchModelsWithStatus(): Promise<ModelTampil[]> {
  const list = await fetchModels();
  const aktif = list.filter((m) => STATUS_AKTIF.includes(m.status.toLowerCase()));
  if (aktif.length === 0) return list;
  const hasil = await Promise.all(
    aktif.map((m) =>
      fetchStatus(m.id)
        .then((s): { id: string; s: StatusDto } => ({ id: m.id, s }))
        .catch((): null => null),
    ),
  );
  const peta: Record<string, StatusDto> = {};
  for (const h of hasil) {
    if (h !== null) peta[h.id] = h.s;
  }
  return list.map((m) => {
    const s = peta[m.id];
    return s
      ? { ...m, status: s.status, progress: s.progress, failureMessage: s.failureMessage }
      : m;
  });
}

function labelStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "success":
      return tSync("statusSiap");
    case "failed":
      return tSync("statusGagal");
    case "timeout":
      return tSync("statusKedaluwarsa");
    case "pending":
      return tSync("statusAntre");
    case "inprogress":
    case "in_progress":
    case "processing":
      return tSync("statusTerjemah");
    default:
      return status;
  }
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const s = status.toLowerCase();
  const color =
    s === "success"
      ? "bg-green-100 text-green-800"
      : s === "failed" || s === "error" || s === "timeout"
        ? "bg-red-100 text-red-800"
        : s === "pending"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-blue-100 text-blue-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {labelStatus(status)}
    </span>
  );
}

interface Toast {
  pesan: string;
  jenis: "sukses" | "galat";
}

function UploadDropzone({
  onPilih,
  sedangUnggah,
  besar,
}: {
  onPilih: (file: File) => void;
  sedangUnggah: boolean;
  besar?: boolean;
}): JSX.Element {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bahasa = useBahasaStore((s) => s.bahasa);
  const t = (k: KunciTeks): string => strings[bahasa][k];

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPilih(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded border-2 border-dashed text-center text-sm ${
        besar ? "p-12 text-base" : "p-6"
      } ${drag ? "border-blue-500 bg-blue-50" : "border-slate-300"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".rvt"
        className="hidden"
        disabled={sedangUnggah}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPilih(f);
        }}
      />
      <p className="font-medium">{t("dropJudul")}</p>
      <p className="mt-1 text-slate-500">{t("dropIsi")}</p>
    </div>
  );
}

export default function ModelsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<Toast | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [namaUnggah, setNamaUnggah] = useState<string>("");
  const bahasa = useBahasaStore((s) => s.bahasa);
  const t = (k: KunciTeks): string => strings[bahasa][k];

  function tampilToast(pesan: string, jenis: Toast["jenis"]): void {
    setToast({ pesan, jenis });
    window.setTimeout(() => setToast(null), 6000);
  }

  const modelsQuery = useQuery({
    queryKey: ["models", bahasa],
    queryFn: fetchModelsWithStatus,
    refetchInterval: (query) => {
      const data = query.state.data as ModelTampil[] | undefined;
      const adaAktif = data?.some((m) => STATUS_AKTIF.includes(m.status.toLowerCase()));
      return adaAktif ? 5000 : false;
    },
  });

  const unggahMutation = useMutation({
    mutationFn: (file: File) => {
      setNamaUnggah(file.name);
      setProgress(0);
      const nama = file.name.replace(/\.rvt$/i, "");
      return uploadModel(file, nama, (p) => setProgress(p));
    },
    onSuccess: () => {
      setProgress(null);
      tampilToast(t("toastTerkirim"), "sukses");
      void queryClient.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e: unknown) => {
      setProgress(null);
      tampilToast(e instanceof Error ? e.message : t("toastUnggahGagal"), "galat");
    },
  });

  const contohMutation = useMutation({
    mutationFn: () => uploadSample(),
    onSuccess: () => {
      tampilToast(t("toastContohSiap"), "sukses");
      void queryClient.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e: unknown) => {
      tampilToast(e instanceof Error ? e.message : t("toastContohGagal"), "galat");
    },
  });

  const hapusMutation = useMutation({
    mutationFn: (id: string) => deleteModel(id),
    onSuccess: () => {
      tampilToast(t("toastHapusOk"), "sukses");
      void queryClient.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e: unknown) => {
      tampilToast(e instanceof Error ? e.message : t("toastHapusGagal"), "galat");
    },
  });

  function handlePilih(file: File): void {
    if (!file.name.toLowerCase().endsWith(".rvt")) {
      tampilToast(t("toastHarusRvt"), "galat");
      return;
    }
    unggahMutation.mutate(file);
  }

  function handleHapus(m: ModelDto): void {
    if (!window.confirm(format(t("hapusKonfirmasi"), { nama: m.name }))) return;
    hapusMutation.mutate(m.id);
  }

  const models = modelsQuery.data ?? [];
  const kosong =
    modelsQuery.isSuccess && models.length === 0 && !unggahMutation.isPending && progress === null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold">{t("modelsJudul")}</h1>

      {!kosong && (
        <div className="mt-6">
          <UploadDropzone onPilih={handlePilih} sedangUnggah={unggahMutation.isPending} />
          {progress !== null && (
            <div className="mt-3">
              <p className="text-sm text-slate-600">
                {format(t("tahap1"), { nama: namaUnggah, progress })}
              </p>
              <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        {modelsQuery.isPending && (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded border p-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
              </li>
            ))}
          </ul>
        )}
        {modelsQuery.isError && (
          <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {t("modelsGagalMuat")}
          </p>
        )}
        {kosong && (
          <section className="mt-8 rounded-lg border bg-slate-50 p-8 text-center dark:bg-slate-900">
            <h2 className="text-2xl font-bold">{t("modelsKosongJudul")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {t("modelsKosongDeskripsi")}
            </p>
            <ol className="mx-auto mt-4 grid max-w-2xl gap-3 text-left text-sm sm:grid-cols-3">
              <li className="rounded border bg-white p-3">
                <span className="font-bold">{t("modelsLangkah1")}</span>
                {t("modelsLangkah1Isi")}
              </li>
              <li className="rounded border bg-white p-3">
                <span className="font-bold">{t("modelsLangkah2")}</span>
                {t("modelsLangkah2Isi")}
              </li>
              <li className="rounded border bg-white p-3">
                <span className="font-bold">{t("modelsLangkah3")}</span>
                {t("modelsLangkah3Isi")}
              </li>
            </ol>
            <div className="mx-auto mt-6 max-w-2xl">
              <UploadDropzone onPilih={handlePilih} sedangUnggah={unggahMutation.isPending} besar />
            </div>
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <span className="text-slate-400">{t("modelsAtau")}</span>
              <button
                type="button"
                onClick={() => contohMutation.mutate()}
                disabled={contohMutation.isPending}
                className="rounded border border-blue-300 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {contohMutation.isPending ? t("modelsMenyiapkan") : t("modelsLihatContoh")}
              </button>
            </div>
          </section>
        )}
        {modelsQuery.isSuccess && models.length > 0 && (
          <ul className="space-y-3">
            {models.map((m) => {
              const aktif = STATUS_AKTIF.includes(m.status.toLowerCase());
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border p-4"
                >
                  <div className="min-w-0 flex-1">
                    {m.status.toLowerCase() === "success" ? (
                      <Link
                        to={`/models/${m.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {m.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{m.name}</span>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      {(m.sizeBytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {new Date(m.createdAt).toLocaleString(
                        bahasa === "id" ? "id-ID" : "en-US",
                      )}
                    </p>
                    {aktif && (
                      <div className="mt-2 max-w-md">
                        <p className="text-sm text-slate-600">
                          {format(t("tahap2"), { progress: m.progress })}
                        </p>
                        <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200">
                          <div
                            className="h-full bg-green-600 transition-all"
                            style={{ width: `${m.progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {t("modelsBesarCatatan")}
                        </p>
                      </div>
                    )}
                    {m.status.toLowerCase() === "failed" && m.failureMessage && (
                      <p className="mt-1 max-w-md truncate text-sm text-red-600" title={m.failureMessage}>
                        {m.failureMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={m.status} />
                    <button
                      type="button"
                      onClick={() => handleHapus(m)}
                      disabled={hapusMutation.isPending}
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t("modelsHapus")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 max-w-sm rounded px-4 py-2 text-sm text-white shadow ${
            toast.jenis === "sukses" ? "bg-green-700" : "bg-red-700"
          }`}
        >
          {toast.pesan}
        </div>
      )}
    </main>
  );
}
