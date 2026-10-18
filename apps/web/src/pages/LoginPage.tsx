import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError, login } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { useT } from "../store/bahasa";

export default function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t("loginButuh"));
      return;
    }
    setPending(true);
    try {
      const token = await login(email.trim(), password);
      setAuth(token, email.trim());
      const from =
        typeof location.state === "object" &&
        location.state !== null &&
        "from" in location.state &&
        typeof location.state.from === "string"
          ? location.state.from
          : "/models";
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t("loginGalatUmum"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">{t("loginJudul")}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {t("loginDeskripsi")}
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium">
            {t("loginKataSandi")}
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {pending ? t("loginMemproses") : t("loginJudul")}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        {t("loginBelum")}{" "}
        <Link to="/register" className="text-blue-600 hover:underline">
          {t("loginDaftar")}
        </Link>
      </p>
    </main>
  );
}
