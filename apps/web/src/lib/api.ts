const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export interface HealthResponse {
  status: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check gagal: ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}
