import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import ModelsPage from "./pages/ModelsPage";
import ViewerPage from "./pages/ViewerPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RequireAuth from "./components/RequireAuth";
import Wordmark from "./components/Wordmark";
import ErrorBoundary from "./components/ErrorBoundary";
import BahasaToggle from "./components/BahasaToggle";
import { useAuthStore } from "./store/auth";
import { useT } from "./store/bahasa";

const TEMA_KUNCI = "yutria3d-tema";

function Layout({ children }: { children: React.ReactNode }): JSX.Element {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const t = useT();
  const [gelap, setGelap] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(TEMA_KUNCI) === "gelap";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", gelap);
    document.documentElement.style.colorScheme = gelap ? "dark" : "light";
    try {
      window.localStorage.setItem(TEMA_KUNCI, gelap ? "gelap" : "terang");
    } catch {
      /* abaikan: tema tetap berlaku sesi ini */
    }
  }, [gelap]);

  function handleLogout(): void {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b dark:border-slate-700">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/" aria-label={t("navBeranda")}>
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <BahasaToggle />
            <button
              type="button"
              onClick={() => setGelap((v) => !v)}
              aria-pressed={gelap}
              title={t("temaGanti")}
              className="rounded border px-2 py-1 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              {gelap ? t("temaTerang") : t("temaGelap")}
            </button>
            <Link to="/models" className="hover:underline">
              {t("navFile3d")}
            </Link>
            {token ? (
              <button
                type="button"
                onClick={handleLogout}
                className="hover:underline"
              >
                {t("navKeluar")}
              </button>
            ) : (
              <Link to="/login" className="hover:underline">
                {t("navMasuk")}
              </Link>
            )}
          </div>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t px-6 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {t("footer")}
      </footer>
    </div>
  );
}

function HomePage(): JSX.Element {
  const t = useT();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Yutria3D</h1>
      <p className="mt-4 text-slate-600">
        {t("homeDeskripsi")}
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          to="/models"
          className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          {t("homeLihat")}
        </Link>
        <span className="rounded border border-slate-200 px-4 py-2 text-slate-400">
          {t("homePetunjuk")}
        </span>
      </div>
    </main>
  );
}


export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/models"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <ModelsPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
          <Route
            path="/models/:id"
            element={
              <RequireAuth>
                <ErrorBoundary>
                  <ViewerPage />
                </ErrorBoundary>
              </RequireAuth>
            }
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
