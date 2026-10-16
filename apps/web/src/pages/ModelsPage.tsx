import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchHealth } from "../lib/api";
import { useViewerStore } from "../store/viewer";

export default function ModelsPage(): JSX.Element {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
  });
  const lastModelId = useViewerStore((s) => s.lastModelId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold">Models</h1>
      <p className="mt-2 text-slate-600">
        Daftar model 3D. Tahap c/d akan menampilkan daftar nyata dari API.
      </p>

      <div className="mt-6 rounded border p-4 text-sm">
        {isPending && <p>Memeriksa status API…</p>}
        {isError && (
          <p>
            API belum terhubung. Pastikan <code>VITE_API_URL</code> menunjuk ke
            backend.
          </p>
        )}
        {data && (
          <p>
            API status: <strong>{data.status}</strong>
          </p>
        )}
      </div>

      {lastModelId && (
        <p className="mt-4 text-sm">
          Terakhir dibuka:{" "}
          <Link
            to={`/models/${lastModelId}`}
            className="text-blue-600 hover:underline"
          >
            {lastModelId}
          </Link>
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {["contoh"].map((id) => (
          <li key={id} className="rounded border p-4">
            <Link
              to={`/models/${id}`}
              className="font-medium text-blue-600 hover:underline"
            >
              Model {id}
            </Link>
            <p className="text-sm text-slate-500">
              Placeholder — viewer penuh di tahap c/d.
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
