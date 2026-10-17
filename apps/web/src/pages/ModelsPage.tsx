import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  deleteModel,
  fetchModels,
  uploadModel,
  type ModelDto,
} from "../lib/api";

function StatusBadge({ status }: { status: string }): JSX.Element {
  const s = status.toLowerCase();
  const color =
    s === "success"
      ? "bg-green-100 text-green-800"
      : s === "failed" || s === "error"
        ? "bg-red-100 text-red-800"
        : s === "pending"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-blue-100 text-blue-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
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
}: {
  onPilih: (file: File) => void;
  sedangUnggah: boolean;
}): JSX.Element {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      className={`cursor-pointer rounded border-2 border-dashed p-6 text-center text-sm ${
        drag ? "border-blue-500 bg-blue-50" : "border-slate-300"
      }`}
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
      <p className="font-medium">Seret & letakkan file .rvt di sini, atau klik untuk memilih</p>
      <p className="mt-1 text-slate-500">Hanya file berekstensi .rvt</p>
    </div>
  );
}

export default function ModelsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<Toast | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [namaUnggah, setNamaUnggah] = useState<string>("");

  function tampilToast(pesan: string, jenis: Toast["jenis"]): void {
    setToast({ pesan, jenis });
    window.setTimeout(() => setToast(null), 4000);
  }

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: fetchModels,
    refetchInterval: (query) => {
      const data = query.state.data as ModelDto[] | undefined;
      const adaAktif = data?.some((m) => {
        const s = m.status.toLowerCase();
        return s === "pending" || s === "inprogress" || s === "in_progress" || s === "processing";
      });
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
      tampilToast("Unggahan berhasil.", "sukses");
      void queryClient.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e: unknown) => {
      setProgress(null);
      tampilToast(e instanceof Error ? e.message : "Unggahan gagal.", "galat");
    },
  });

  const hapusMutation = useMutation({
    mutationFn: (id: string) => deleteModel(id),
    onSuccess: () => {
      tampilToast("Model dihapus.", "sukses");
      void queryClient.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e: unknown) => {
      tampilToast(e instanceof Error ? e.message : "Gagal menghapus.", "galat");
    },
  });

  function handlePilih(file: File): void {
    if (!file.name.toLowerCase().endsWith(".rvt")) {
      tampilToast("File harus berekstensi .rvt.", "galat");
      return;
    }
    unggahMutation.mutate(file);
  }

  function handleHapus(m: ModelDto): void {
    if (!window.confirm(`Hapus model "${m.name}"?`)) return;
    hapusMutation.mutate(m.id);
  }

  const models = modelsQuery.data ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold">Model Saya</h1>

      <div className="mt-6">
        <UploadDropzone onPilih={handlePilih} sedangUnggah={unggahMutation.isPending} />
        {progress !== null && (
          <div className="mt-3">
            <p className="text-sm text-slate-600">
              Mengunggah {namaUnggah}… {progress}%
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
            Gagal memuat daftar model. Coba lagi.
          </p>
        )}
        {modelsQuery.isSuccess && models.length === 0 && (
          <p className="rounded border p-4 text-sm text-slate-500">
            Belum ada model. Unggah file .rvt pertama Anda.
          </p>
        )}
        {modelsQuery.isSuccess && models.length > 0 && (
          <ul className="space-y-3">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border p-4"
              >
                <div>
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
                    {new Date(m.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={m.status} />
                  <button
                    type="button"
                    onClick={() => handleHapus(m)}
                    disabled={hapusMutation.isPending}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 rounded px-4 py-2 text-sm text-white shadow ${
            toast.jenis === "sukses" ? "bg-green-700" : "bg-red-700"
          }`}
        >
          {toast.pesan}
        </div>
      )}
    </main>
  );
}
