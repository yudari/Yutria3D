# Yutria3D

Aplikasi web 3D berbasis **Autodesk Platform Services (APS)** — upload model RVT, terjemahkan via Model Derivative API, dan tampilkan di Forge Viewer.

> Didukung oleh Autodesk Platform Services

## Daftar Isi

- [Mendaftar Aplikasi APS](#mendaftar-aplikasi-aps)
- [Setup Lokal](#setup-lokal)
- [Perintah](#perintah)
- [Struktur Proyek](#struktur-proyek)
- [Deploy ke Render](#deploy-ke-render)
- [Batasan](#batasan)

## Mendaftar Aplikasi APS

1. Buka [APS Portal](https://aps.autodesk.com/) dan buat akun.
2. Masuk ke **My Apps** → **Create App**, isi nama `Yutria3D`.
3. Catat **Client ID** dan **Client Secret**.
4. Aktifkan API berikut untuk app tersebut:
   - **Authentication (OAuth)** — token 2-legged (`client_credentials`).
   - **OSS (Object Storage Service)** — bucket & upload objek.
   - **Model Derivative** — job terjemahan, manifest, dan thumbnail.
5. Callback URL tidak diperlukan (alur 2-legged server-ke-server).
6. Scope OAuth yang diminta backend (`ApsTokenService` / `ApsClient`):
   `data:read data:write data:create bucket:create bucket:read` untuk data,
   `viewables:read` untuk token viewer.
7. Isi `.env` dari `.env.example`:
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET` dari langkah 3.
   - `APS_BUCKET` — nama bucket (huruf kecil, unik global); dibuat otomatis bila belum ada.
   - `MAX_UPLOAD_MB` — batas ukuran upload (500).

## Setup Lokal

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

Terapkan migrasi EF Core, lalu jalankan backend + frontend (dua terminal):

```bash
dotnet ef database update --project apps/api/Yutria3D.Api
dotnet run --project apps/api/Yutria3D.Api --urls http://127.0.0.1:5000
pnpm --filter @yutria3d/web dev
```

- Swagger (Development saja): http://127.0.0.1:5000/swagger
- Health: http://127.0.0.1:5000/health
- Frontend: http://localhost:5173

> Windows: pakai `127.0.0.1` eksplisit untuk Postgres/API — `localhost` bisa
> resolve ke `::1` (IPv6) dan koneksi Npgsql/EF gagal dengan error 10053.

Alternatif `user-secrets` (tanpa file `.env`) untuk backend:

```bash
dotnet user-secrets init --project apps/api/Yutria3D.Api
dotnet user-secrets set "APS_CLIENT_ID" "<id>" --project apps/api/Yutria3D.Api
dotnet user-secrets set "APS_CLIENT_SECRET" "<secret>" --project apps/api/Yutria3D.Api
```

`SAMPLE_DIR` opsional — menunjuk direktori file `.rvt` contoh; bila kosong
dipakai `SampleFiles` bawaan output build.

## Perintah

| Perintah | Fungsi |
| -------- | ------ |
| `pnpm dev` | Jalankan API + web sekaligus (concurrently). |
| `pnpm dev:api` | Jalankan backend (`apps/api/Yutria3D.Api`, `http://127.0.0.1:5000`). |
| `pnpm dev:web` | Jalankan frontend (`apps/web`, Vite, port 5173). |
| `pnpm build` | Build rekursif semua workspace. |
| `pnpm lint` | Lint rekursif semua workspace. |
| `pnpm gen:types` | Generate tipe TS dari Swagger API (lihat penjelasan). |
| `docker compose up --build` | Jalankan postgres + api + web. |
| `docker compose config` | Validasi compose tanpa start container. |
| `dotnet ef database update --project apps/api/Yutria3D.Api` | Terapkan migrasi ke Postgres lokal. |

### Generate tipe (`packages/api-types`)

`packages/api-types` berisi tipe TS hasil generate OpenAPI. Setelah API berjalan:

```bash
pnpm --filter @yutria3d/api-types gen
```

Script `gen` memakai `openapi-typescript` terhadap
`${VITE_API_URL:-http://localhost:5000}/swagger/v1/swagger.json` dan menulis
`src/schema.ts`. Lihat README paket untuk detail.

## Struktur Proyek

```text
Yutria3D/
├── apps/
│   ├── web/                 # Frontend Vite React 18 + TS (@yutria3d/web)
│   │   ├── Dockerfile       # Build pnpm (corepack) + serve nginx
│   │   └── src/lib/api.ts   # Klien API (VITE_API_URL dibakar saat build)
│   └── api/
│       └── Yutria3D.Api/    # Backend ASP.NET Core 8
│           ├── Program.cs   # Config, NormalizeDatabaseUrl, CORS, /health
│           ├── Controllers/ # /api/auth/*, /api/models*
│           └── SampleFiles/ # .rvt contoh (CopyToOutput)
├── packages/
│   └── api-types/           # Tipe TS hasil generate OpenAPI (@yutria3d/api-types)
├── package.json             # Scripts root (concurrently api+web)
├── pnpm-workspace.yaml
├── Yutria3D.sln             # Solusi .NET (Api + Tests)
├── Dockerfile.api           # Image backend (SDK 8 build → ASP.NET 8 runtime)
├── docker-compose.yml       # postgres + api + web (dev lokal)
├── render.yaml              # Blueprint deploy Render (prod)
└── .env.example
```

Backend membaca konfigurasi: `ConnectionStrings:Default`, `DATABASE_URL`
(keduanya format ADO.NET `Host=...`, kecuali URL `postgres://...` dari Render
yang dikonversi otomatis oleh `Program.NormalizeDatabaseUrl`), `WEB_ORIGIN`,
`JWT_KEY`, `Aps:{ClientId,ClientSecret,Bucket,MaxUploadMb}`, plus env
`APS_CLIENT_ID`/`APS_CLIENT_SECRET`/`APS_BUCKET`/`MAX_UPLOAD_MB` via fallback
`PostConfigure`, dan `SAMPLE_DIR` opsional.

## Deploy ke Render

Arsitektur Blueprint (`render.yaml`): 1 web service .NET (Docker,
`Dockerfile.api`, health check `/health`), 1 static site (Vite,
`apps/web`, build `pnpm install && pnpm build`), 1 Postgres free.

Langkah:

1. Push repo ke GitHub.
2. Di dashboard Render: **New +** → **Blueprint** → pilih repo ini.
3. Isi secret yang ditandai `sync: false`: `APS_CLIENT_ID`,
   `APS_CLIENT_SECRET` (dari [Mendaftar Aplikasi APS](#mendaftar-aplikasi-aps)).
   `JWT_KEY` terisi otomatis (`generateValue`).
4. Apply — Render membuat `yutria3d-api`, `yutria3d-web`, dan `yutria3d-db`.
5. Migrasi DB awal: setelah deploy, jalankan sekali via Render Shell di service
   API (`dotnet Yutria3D.Api.dll` sudah jalan — gunakan endpoint/migrasi manual:
   `dotnet ef database update` dari mesin lokal dengan `DATABASE_URL` eksternal
   Render, atau jalankan `app` dengan migrasi otomatis bila ditambahkan).
6. `VITE_API_URL` dibakar ke bundle saat build static site, jadi setiap ganti
   URL backend harus redeploy static site.

Env yang di-set Blueprint:

| Service | Key | Sumber |
| ------- | --- | ------ |
| api | `DATABASE_URL` | `fromDatabase: yutria3d-db.connectionString` |
| api | `WEB_ORIGIN` | `fromService: yutria3d-web.host` (skema dilengkapi otomatis) |
| api | `APS_CLIENT_ID` / `APS_CLIENT_SECRET` | manual (`sync: false`) |
| api | `APS_BUCKET` | `yutria3d-bucket` |
| api | `MAX_UPLOAD_MB` | `500` |
| api | `JWT_KEY` | `generateValue` |
| web | `VITE_API_URL` | `fromService: yutria3d-api.host` (skema dilengkapi otomatis) |

## Batasan

- **Sleep free tier**: service web Render free mati setelah idle ±15 menit;
  request pertama setelah tidur butuh ±30–60 dtk (cold start), dan Postgres
  free kedaluwarsa setelah 90 hari tanpa aktivitas.
- **Translate RVT besar**: butuh waktu menit–jam di sisi Autodesk; `MAX_UPLOAD_MB=500`
  hanya batas upload, bukan jaminan cepat. File besar sebaiknya via
  direct-to-S3 signed URL (tahap lanjutan, belum tersedia).
- **Bucket retention**: objek OSS di bucket trial/dev dapat dihapus otomatis
  oleh Autodesk setelah 30 hari tidak diakses — upload ulang bila 404.
- **File contoh milik kredensial lama**: `POST /api/models/sample` menautkan
  objek `d4de4c01…​.rvt` di bucket `yutria3d-bucket` milik kredensial dev lama.
  Bila memakai kredensial APS baru, objek itu tidak ada di bucket Anda —
  ganti konstanta `SampleBucketKey`/`SampleObjectKey`/`SampleUrn`/
  `SampleSizeBytes` di `apps/api/Yutria3D.Api/Controllers/ModelsController.cs`
  dengan objek hasil upload+translate milik Anda sendiri (lihat URN di respons
  upload), atau upload ulang file contoh via `POST /api/models`.
- Jangan commit `.env` berisi secret; `JWT_KEY` default hanya untuk
  pengembangan lokal.
