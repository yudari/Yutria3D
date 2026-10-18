import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, register } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { useT } from "../store/bahasa";

export default function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t("daftarButuh"));
      return;
    }
    if (password.length < 8) {
      setError(t("daftarMin"));
      return;
    }
    if (password !== confirm) {
      setError(t("daftarTakCocok"));
      return;
    }
    setPending(true);
    try {
      const token = await register(email.trim(), password);
      setAuth(token, email.trim());
      navigate("/models", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t("daftarGalatUmum"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">{t("daftarJudul")}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {t("daftarDeskripsi")}
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label
            htmlFor="register-password"
            className="block text-sm font-medium"
          >
            {t("daftarKataSandi")}
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label
            htmlFor="register-confirm"
            className="block text-sm font-medium"
          >
            {t("daftarKonfirmasi")}
          </label>
          <input
            id="register-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? t("daftarMemproses") : t("daftarJudul")}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        {t("daftarSudah")}{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          {t("daftarMasuk")}
        </Link>
      </p>
    </main>
  );
}
