import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "../store/bahasa";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  galat: Error | null;
}

/** Batas galat rute + tombol muat ulang (mendukung ID/EN). */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { galat: null };
  }

  static getDerivedStateFromError(galat: Error): ErrorBoundaryState {
    return { galat };
  }

  componentDidCatch(galat: Error, info: ErrorInfo): void {
    console.error("Halaman gagal ditampilkan:", galat, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.galat !== null) {
      return <FallbackGalat />;
    }
    return this.props.children;
  }
}

function FallbackGalat(): JSX.Element {
  const t = useT();
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("galatJudul")}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{t("galatIsi")}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
      >
        {t("galatMuatUlang")}
      </button>
    </main>
  );
}

export default ErrorBoundary;
