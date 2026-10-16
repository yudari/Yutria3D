import { Link, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import ModelsPage from "./pages/ModelsPage";
import ViewerPage from "./pages/ViewerPage";
import Wordmark from "./components/Wordmark";

function HomePage(): JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Yutria3D</h1>
      <p className="mt-4 text-slate-600">
        Pratinjau dan kelola model 3D berbasis Autodesk Platform Services.
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          to="/models"
          className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          Lihat Model
        </Link>
        <Link
          to="/models/contoh"
          className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-100"
        >
          Buka Viewer
        </Link>
      </div>
    </main>
  );
}

function Layout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/" aria-label="Yutria3D beranda">
            <Wordmark />
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/models" className="hover:underline">
              Models
            </Link>
            <Link to="/models/contoh" className="hover:underline">
              Viewer
            </Link>
          </div>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t px-6 py-4 text-center text-sm text-slate-500">
        Didukung oleh Autodesk Platform Services
      </footer>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/models/:id" element={<ViewerPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
