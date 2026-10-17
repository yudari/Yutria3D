import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  galat: Error | null;
}

/** Batas galat rute: fallback Bahasa Indonesia + tombol muat ulang. */
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
      return (
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <h1 className="text-2xl font-bold">Terjadi kesalahan</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Halaman gagal ditampilkan. Coba muat ulang halaman.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
          >
            Muat ulang
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
