import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useViewerStore } from "../store/viewer";

export default function ViewerPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const setLastModelId = useViewerStore((s) => s.setLastModelId);

  useEffect(() => {
    if (id) setLastModelId(id);
  }, [id, setLastModelId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/models" className="text-sm text-blue-600 hover:underline">
        &larr; Kembali ke Models
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Viewer: {id}</h1>
      <div className="mt-6 flex h-96 items-center justify-center rounded border border-dashed bg-slate-50">
        <p className="text-slate-500">
          Placeholder viewer — integrasi APS Viewer di tahap c/d.
        </p>
      </div>
    </main>
  );
}
