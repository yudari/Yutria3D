import {
  bacaBahasa,
  format,
  strings,
  type KunciTeks,
} from "../i18n/translations";

function t(k: KunciTeks): string {
  try {
    return strings[bacaBahasa()][k];
  } catch {
    return strings.id[k];
  }
}

function normalizeApiUrl(raw: string | undefined): string {
  const fallback = "http://localhost:5000";
  const value = (raw ?? "").trim() || fallback;
  // Render `fromService ... property: host` hanya memberi hostname (tanpa skema).
  return value.includes("://") ? value : `https://${value}`;
}

const API_URL = normalizeApiUrl(
  import.meta.env.VITE_API_URL as string | undefined,
);

export const TOKEN_KEY = "yutria3d.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export interface AuthResponse {
  token: string;
}

export interface ModelDto {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
  status: string;
  progress: number;
}

export interface ModelDetailDto extends ModelDto {
  urn: string;
}

export interface StatusDto {
  status: string;
  progress: number;
  failureMessage: string | null;
}

export interface ViewerTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface HealthResponse {
  status: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function errorMessage(res: Response, fallback: string): Promise<string> {
  return res
    .json()
    .then((body: unknown) => {
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        return body.error;
      }
      return `${fallback} (kode ${res.status})`;
    })
    .catch(() => `${fallback} (kode ${res.status})`);
}

/** fetch dengan header Authorization dari token localStorage. */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

function readAuthToken(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  if ("token" in data && typeof data.token === "string") return data.token;
  if ("Token" in data && typeof data.Token === "string") return data.Token;
  return null;
}

export async function register(
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok)
    throw new ApiError(
      res.status,
      await errorMessage(res, t("apiDaftarGagal")),
    );
  const token = readAuthToken(await res.json());
  if (!token) throw new ApiError(res.status, t("apiResponsTakValid"));
  return token;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    if (res.status === 401)
      throw new ApiError(res.status, t("apiKredensialSalah"));
    throw new ApiError(res.status, await errorMessage(res, t("apiMasukGagal")));
  }
  const token = readAuthToken(await res.json());
  if (!token) throw new ApiError(res.status, t("apiResponsTakValid"));
  return token;
}

export async function fetchModels(): Promise<ModelDto[]> {
  const res = await authFetch("/api/models");
  if (res.status === 401)
    throw new ApiError(401, t("apiSesiBerakhir"));
  if (!res.ok)
    throw new ApiError(
      res.status,
      await errorMessage(res, t("apiDaftarGagalMuat")),
    );
  const data: unknown = await res.json();
  if (!Array.isArray(data))
    throw new ApiError(res.status, t("apiResponsTakValid"));
  return data as ModelDto[];
}

export async function fetchModelById(id: string): Promise<ModelDetailDto> {
  const res = await authFetch(`/api/models/${id}`);
  if (res.status === 401)
    throw new ApiError(401, t("apiSesiBerakhir"));
  if (res.status === 404) throw new ApiError(404, t("apiTakDitemukan"));
  if (!res.ok)
    throw new ApiError(
      res.status,
      await errorMessage(res, t("apiDetailGagal")),
    );
  return (await res.json()) as ModelDetailDto;
}

export async function fetchStatus(id: string): Promise<StatusDto> {
  const res = await authFetch(`/api/models/${id}/status`);
  if (res.status === 401)
    throw new ApiError(401, t("apiSesiBerakhir"));
  if (res.status === 404) throw new ApiError(404, t("apiTakDitemukan"));
  if (!res.ok)
    throw new ApiError(
      res.status,
      await errorMessage(res, t("apiStatusGagal")),
    );
  return (await res.json()) as StatusDto;
}

export async function deleteModel(id: string): Promise<void> {
  const res = await authFetch(`/api/models/${id}`, { method: "DELETE" });
  if (res.status === 401)
    throw new ApiError(401, t("apiSesiBerakhir"));
  if (res.status === 404) throw new ApiError(404, t("apiTakDitemukan"));
  if (!res.ok)
    throw new ApiError(
      res.status,
      await errorMessage(res, t("apiHapusGagal")),
    );
}

/** Minta server menyalin file contoh ke akun pengguna. */
export async function uploadSample(): Promise<ModelDetailDto> {
  const res = await authFetch("/api/models/sample", { method: "POST" });
  if (res.status === 401)
    throw new ApiError(401, t("apiSesiBerakhir"));
  if (res.status === 404)
    throw new ApiError(404, t("apiContohTakAda"));
  if (!res.ok)
    throw new ApiError(
      res.status,
      await errorMessage(res, t("apiContohGagal")),
    );
  return (await res.json()) as ModelDetailDto;
}

export function uploadModel(
  file: File,
  name?: string,
  onProgress?: (pct: number) => void,
): Promise<ModelDetailDto> {
  // Executor form: XHR selesai lewat callback onload/onerror.
  return new Promise<ModelDetailDto>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/models`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as ModelDetailDto);
        return;
      }
      if (xhr.status === 401) {
        reject(new ApiError(401, t("apiSesiBerakhir")));
        return;
      }
      const body: unknown = xhr.response;
      const msg =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : format(t("apiUnggahGagal"), { kode: xhr.status });
      reject(new ApiError(xhr.status, msg));
    };

    xhr.onerror = () => {
      reject(new ApiError(0, t("apiTakTerhubung")));
    };

    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    xhr.send(form);
  });
}

export async function fetchViewerToken(): Promise<ViewerTokenResponse> {
  const res = await authFetch("/api/auth/token");
  if (res.status === 401)
    throw new ApiError(401, t("apiSesiBerakhir"));
  if (!res.ok)
    throw new ApiError(
      res.status,
      await errorMessage(res, t("apiTokenGagal")),
    );
  const data: unknown = await res.json();
  if (typeof data !== "object" || data === null)
    throw new ApiError(res.status, t("apiResponsTakValid"));
  const accessToken =
    "accessToken" in data && typeof data.accessToken === "string"
      ? data.accessToken
      : "AccessToken" in data && typeof data.AccessToken === "string"
        ? data.AccessToken
        : null;
  const expiresIn =
    "expiresIn" in data && typeof data.expiresIn === "number"
      ? data.expiresIn
      : "ExpiresIn" in data && typeof data.ExpiresIn === "number"
        ? data.ExpiresIn
        : null;
  if (accessToken === null || expiresIn === null)
    throw new ApiError(res.status, t("apiResponsTakValid"));
  return { accessToken, expiresIn };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check gagal: ${res.status}`);
  const data: unknown = await res.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("status" in data) ||
    typeof data.status !== "string"
  ) {
    throw new Error(t("apiResponsTakValid"));
  }
  return { status: data.status };
}
