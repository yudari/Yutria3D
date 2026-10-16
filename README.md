# Yutria3D

Aplikasi web 3D berbasis **Autodesk Platform Services (APS)** — upload model, terjemahkan via Model Derivative API, dan tampilkan di Forge Viewer.

> Didukung oleh Autodesk Platform Services

## Daftar Isi

- [Mendaftar Aplikasi APS](#mendaftar-aplikasi-aps)
- [Setup](#setup)
- [Perintah](#perintah)
- [Struktur](#struktur)
- [Batasan](#batasan)

## Mendaftar Aplikasi APS

1. Buka [APS Portal](https://aps.autodesk.com/) dan buat akun.
2. Masuk ke **My Apps** → **Create App**, isi nama `Yutria3D`.
3. Catat **Client ID** dan **Client Secret**.
4. Aktifkan API berikut untuk app tersebut:
   - **Authentication (OAuth)** — token 2-legged.
   - **OSS (Object Storage Service)** — bucket & upload objek.
   - **Model Derivative** — job terjemahan dan manifest/thumbnail.
5. Callback URL tidak diperlukan (alur 2-legged server-to-server).
6. Isi `.env` dari `.env.example`:
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET` dari langkah 3.
   - `APS_BUCKET` — nama bucket (huruf kecil, unik global); dibuat otomatis bila belum ada.
   - `MAX_UPLOAD_MB` — batas ukuran upload (default 100).

## Setup

Prasyarat: .NET SDK 8, Node 20+, pnpm 9, Postgres 16 (atau Docker).

```bash
cp .env.example .env        # Windows: copy .env.example .env
pnpm install
dotnet restore Yutria3D.sln
```

Jalankan Postgres lokal atau via compose:

```bash
docker compose up -d postgres
```

## Perintah

| Perintah           | Fungsi                                              |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Jalankan frontend (`apps/web`, Vite, port 5173).    |
| `pnpm build`       | Build rekursif semua workspace.                     |
| `pnpm lint`        | Lint rekursif semua workspace.                      |
| `pnpm gen:types`   | Generate tipe TS dari Swagger API (lihat penjelasan). |
| `docker compose up --build` | Jalankan postgres + api + web.               |

Backend dijalankan terpisah:

```bash
dotnet run --project apps/api/Yutria3D.Api.csproj
# Swagger: http://localhost:5000/swagger, health: http://localhost:5000/health
```

### Generate tipe (`packages/api-types`)

`packages/api-types` berisi `index.ts` placeholder hingga API tahap (b) menyediakan Swagger JSON.
Setelah API berjalan:

```bash
pnpm --filter @yutria3d/api-types gen
```

Script `gen` memakai `openapi-typescript` terhadap `${VITE_API_URL:-http://localhost:5000}/swagger/v1/swagger.json` dan menulis `src/generated.ts`. Lihat README paket untuk detail.

## Struktur

```text
Yutria3D/
├── apps/
│   ├── web/                 # Frontend Vite React 18 + TS (@yutria3d/web)
│   └── api/                 # Backend ASP.NET Core 8 (Yutria3D.Api)
├── packages/
│   └── api-types/           # Tipe TS hasil generate OpenAPI (@yutria3d/api-types)
├── package.json             # Workspaces + scripts root
├── pnpm-workspace.yaml
├── Yutria3D.sln             # Solusi .NET (Api + Tests)
├── Dockerfile.api           # Image backend
├── docker-compose.yml       # postgres + api + web
└── .env.example
```

## Batasan

- Tahap (a) ini hanya skeleton: halaman Models/Viewer masih placeholder, endpoint Identity/JWT penuh menyusul tahap (b).
- Upload dibatasi `MAX_UPLOAD_MB`; file besar sebaiknya via direct-to-S3 signed URL (tahap lanjutan).
- Viewer membutuhkan token publik dan URN hasil terjemahan Model Derivative (tahap c/d).
- Jangan commit `.env` berisi secret; `JWT_KEY` default hanya untuk pengembangan lokal.
