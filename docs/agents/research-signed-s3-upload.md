# Riset: APS OSS Signed S3 Upload Flow (direct-to-S3)

Bahasa: Indonesia. Semua klaim di bawah merujuk ke sumber primer (referensi HTTP resmi APS + repo resmi `autodesk-platform-services`).

---

## 1. Cara request signed URL untuk multipart upload dengan N part — apakah `?parts=N` valid?

**Ya, `?parts=N` valid.** Endpoint-nya:

- `GET oss/v2/buckets/{bucketKey}/objects/{objectKey}/signeds3upload`
- Referensi: https://aps.autodesk.com/en/docs/data/v2/reference/http/buckets-:bucketKey-objects-:objectKey-signeds3upload-GET
- Deskripsi parameter dari SDK resmi (di-generate dari spesifikasi OpenAPI yang sama dengan referensi di atas): *"parts — The number of parts you intend to chunk the object for uploading. OSS will return that many signed URLs, one URL for each chunk. If you do not specify a value you'll get only one URL to upload the entire object."* — sumber: `oss/source/api/objectsApi.ts`, fungsi `signedS3Upload` di https://github.com/autodesk-platform-services/aps-sdk-node (cari `signedS3Upload: async (accessToken, bucketKey, objectKey, parts?, firstPart?, uploadKey?, minutesExpiration?, useAcceleration?`).

Parameter query lengkap yang didukung (terbukti dari kode SDK Node resmi, yang memetakan 1:1 ke query string):

| Query param | Arti |
|---|---|
| `parts` | Jumlah URL yang diminta (= jumlah part yang akan di-upload dalam batch ini) |
| `firstPart` | Indeks part pertama (mulai dari 1). Contoh: part 10–15 → `firstPart=10&parts=6` |
| `uploadKey` | Kunci sesi upload yang sedang berjalan (untuk meminta URL tambahan setelah batch pertama) |
| `minutesExpiration` | Masa berlaku URL, 1–60 menit, default 2 menit |
| `useAcceleration` | `true` (default) = S3 Transfer Acceleration, `false` = URL S3 standar |

Contoh resmi dari kode utilitas Node.js (blog resmi APS):

```js
let endpoint = `buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload?parts=${parts}&firstPart=${firstPart}`;
if (uploadKey) { endpoint += `&uploadKey=${uploadKey}`; }
if (minutesExpiration) { endpoint += `&minutesExpiration=${minutesExpiration}`; }
const resp = await this.axios.get(endpoint, { headers }); // → { urls: string[], uploadKey: string, ... }
```

Sumber: https://aps.autodesk.com/blog/direct-s3-nodejs-samples (fungsi `_getUploadUrls`).

Alur multipart resmi (pseudo-code README repo resmi):

1. Hitung jumlah part file.
2. `GET buckets/:bucketKey/objects/:objectKey/signeds3upload?firstPart=<index>&parts=<jumlah>` — maks **25 URL per panggilan**; simpan `uploadKey` dari respons.
3. `PUT` tiap part ke URL-nya masing-masing (URL ke-i ↔ part ke-i).
4. Jika URL habis / kedaluwarsa (403), ulangi langkah 2 **dengan `uploadKey` yang sama** dan `firstPart` lanjutan.
5. `POST .../signeds3upload` untuk finalisasi.

Sumber: https://github.com/autodesk-platform-services/aps-directToS3/blob/main/README.md (bagian "Upload", langkah 1–4).

---

## 2. Batasan jumlah part / ukuran part minimum

- **Ukuran part minimum 5 MB untuk semua part kecuali part terakhir.** Jika dilanggar, panggilan complete akan gagal. Sumber:
  - Komentar kode resmi: *"if you are uploading in multiple parts, each part except for the final one must be of size at least 5MB, otherwise the call to _completeUpload will fail"* — https://aps.autodesk.com/blog/direct-s3-nodejs-samples
  - README resmi: *"each uploaded part except for the last one must be at least 5MB"* — https://github.com/autodesk-platform-services/aps-directToS3/blob/main/README.md
  - Implementasi SDK resmi memakai konstanta `ChunkSize = 5 * 1024 * 1024` — `oss/source/custom-code/ossFileTransfer.ts` di https://github.com/autodesk-platform-services/aps-sdk-node
- **Maksimal 25 URL per satu panggilan GET.** Untuk file dengan part lebih banyak, minta batch berikutnya dengan `uploadKey` + `firstPart` lanjutan. Sumber:
  - README resmi (langkah 2: *"Generate up to 25 URLs …"*) — https://github.com/autodesk-platform-services/aps-directToS3/blob/main/README.md
  - Utilitas resmi memakai `MaxBatches = 25` — https://aps.autodesk.com/blog/direct-s3-nodejs-samples
  - SDK resmi memakai `BatchSize = 25` — `oss/source/custom-code/ossFileTransfer.ts` di https://github.com/autodesk-platform-services/aps-sdk-node
- Ini konsisten dengan batasan S3 multipart upload milik AWS (part ≥ 5 MB kecuali terakhir, maks 10.000 part per upload) — tetapi yang mengikat di sisi APS adalah dua angka di atas (5 MB, 25 URL/panggilan).

---

## 3. Format `POST .../signeds3upload` (complete upload) yang benar

- `POST oss/v2/buckets/{bucketKey}/objects/{objectKey}/signeds3upload`
- Referensi: https://aps.autodesk.com/en/docs/data/v2/reference/http/buckets-:bucketKey-objects-:objectKey-signeds3upload-POST
- Ringkasan resmi: *"Requests OSS to assemble and reconstitute the object that was uploaded using signed S3 upload URL. You must call this operation only after all parts/chunks of the object has been uploaded."* — JSDoc `completeSignedS3Upload` di `oss/source/api/objectsApi.ts`, https://github.com/autodesk-platform-services/aps-sdk-node
- Header `Content-Type: application/json` (wajib; SDK menegaskan `contentType` harus `application/json`).
- Body JSON (`Completes3uploadBody`):

```json
{
  "uploadKey": "<uploadKey dari respons GET>",
  "size": 12345678,
  "eTags": ["etag-part-1", "etag-part-2"]
}
```

  - `uploadKey` (string, **wajib**): ID sesi upload dari respons GET.
  - `size` (number, opsional): ekspektasi ukuran objek; OSS menolak jika tidak cocok dengan isi di S3.
  - `eTags` (array string, opsional): eTag tiap part dari respons `PUT` ke S3; indeks array = nomor part; OSS validasi dan menolak jika tidak cocok.
  - Sumber definisi: `oss/source/model/completes3uploadBody.ts` di https://github.com/autodesk-platform-services/aps-sdk-node
- Contoh pemanggilan resmi (Node):

```js
const endpoint = `buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`;
const payload = { uploadKey };
await this.axios.post(endpoint, payload, { headers }); // headers: Content-Type + Authorization
```

Sumber: https://aps.autodesk.com/blog/direct-s3-nodejs-samples (fungsi `_completeUpload`).

- Contoh pemanggilan resmi (.NET SDK — `completeSignedS3Upload(accessToken, bucketKey, objectKey, "application/json", new Completes3uploadBody { uploadKey = uploadKey }, …)`): `oss/source/custom-code/ossFileTransfer.ts` (akhir metode `upload`) dan API tingkat tinggi `OssClient.UploadObjectAsync` di `oss/source/custom-code/OssClient.cs`, https://github.com/autodesk-platform-services/aps-sdk-net
- Header opsional metadata: `x-ads-meta-Content-Type`, `x-ads-meta-Content-Disposition`, `x-ads-meta-Content-Encoding`, `x-ads-meta-Cache-Control`, `x-ads-user-defined-metadata` (maks 100 byte JSON) — sumber: parameter `completeSignedS3Upload` di `oss/source/api/objectsApi.ts`.
- Respons sukses = detail objek (`ObjectDetails`: `bucketKey`, `objectKey`, `objectId`, `sha1`, `size`, `location`, `contentType`).

---

## 4. Kenapa `?parts=7` bisa balas 401 padahal token valid dan request tanpa query 200?

**Karena `parts` adalah query parameter yang valid — 401 bukan disebabkan oleh query tak dikenal, dan endpoint tidak memperlakukan query berbeda sebagai route berbeda.** Buktinya:

- Kode SDK resmi meneruskan `parts` sebagai query param bernama persis `parts` (`localVarQueryParameter['parts'] = parts`) ke path yang sama `/oss/v2/buckets/{bucketKey}/objects/{objectKey}/signeds3upload` — `oss/source/api/objectsApi.ts`, https://github.com/autodesk-platform-services/aps-sdk-node
- Utilitas resmi selalu mengirim `?parts=…&firstPart=…` — https://aps.autodesk.com/blog/direct-s3-nodejs-samples

Arti status menurut dokumentasi/SDK resmi:

- **401 = masalah otorisasi pada request itu** (token kedaluwarsa/invalid, header `Authorization` tidak terkirim karena redirect/proxy, scope kurang — butuh `data:write`/`data:create`). Pesan SDK: *"Access token provided is invalid or expired."* (`ossFileTransfer.ts`).
- **403 = bukan pemilik bucket** (*"Only applications that own the bucket can call this operation. All other applications … will receive a 403 Forbidden"*) atau URL S3 kedaluwarsa saat `PUT` part — bukan 401.

Kemungkinan penyebab 401 spesifik pada kasus "tanpa query 200, dengan `?parts=7` 401" (urut dari paling mungkin):

1. **Dua request memakai token/header berbeda** — mis. request kedua dibuat setelah token di-refresh/di-cache secara salah, atau query string di-sign/di-proxy sehingga header `Authorization: Bearer …` ter-strip. Bandingkan header mentah kedua request.
2. **Scope/token berbeda** — request pertama memakai token `data:write`, request kedua memakai token lain (mis. 2-legged vs 3-legged, atau token viewer `data:read`).
3. **Perbedaan URL-encoding `objectKey`** — jika `objectKey` mengandung karakter khusus (spasi, `+`, unicode), penambahan query bisa mengubah cara client meng-encode path sehingga server gagal mencocokkan resource → respons auth error. SDK resmi selalu `encodeURIComponent(objectKey)`.
4. **Perilaku gateway/proxy di tengah** — beberapa proxy/APIM meneruskan path+query apa adanya; jika ada layer yang memvalidasi allowlist query, ia akan menolak dengan 4xx miliknya sendiri (bukan 401 dari APS). Cek `x-request-id` / body error untuk memastikan error berasal dari APS (`developer.api.autodesk.com`) atau dari perantara.

Cara memastikan: ulangi kedua request (dengan & tanpa `?parts=7`) memakai token, header, dan encoding `objectKey` yang identik dalam satu sesi (mis. `curl -v`), lalu bandingkan body error dan `www-authenticate`. Jika `?parts=7` tetap 401 dengan kredensial identik, sertakan `x-request-id` respons ke dukungan APS — karena menurut sumber primer, parameter tersebut valid dan tidak mengubah route/auth.

---

## Daftar sumber primer

| # | Sumber | URL |
|---|---|---|
| 1 | Referensi HTTP resmi — Generate Signed S3 Upload URL (`GET signeds3upload`) | https://aps.autodesk.com/en/docs/data/v2/reference/http/buckets-:bucketKey-objects-:objectKey-signeds3upload-GET |
| 2 | Referensi HTTP resmi — Complete Upload to S3 Signed URL (`POST signeds3upload`) | https://aps.autodesk.com/en/docs/data/v2/reference/http/buckets-:bucketKey-objects-:objectKey-signeds3upload-POST |
| 3 | Tutorial resmi — Upload file (direct-to-S3) | https://aps.autodesk.com/en/docs/data/v2/tutorials/upload-file/ |
| 4 | Blog resmi — Direct-to-S3 Node.js samples (utilitas `_getUploadUrls`, `_completeUpload`, aturan 5 MB, batch 25) | https://aps.autodesk.com/blog/direct-s3-nodejs-samples |
| 5 | Repo resmi — sample direct-to-S3 + pseudo-code upload (README) | https://github.com/autodesk-platform-services/aps-directToS3/blob/main/README.md |
| 6 | Repo resmi — `aps-sdk-node`, definisi request (`oss/source/api/objectsApi.ts`: `signedS3Upload`, `completeSignedS3Upload`) | https://github.com/autodesk-platform-services/aps-sdk-node |
| 7 | Repo resmi — `aps-sdk-node`, model body (`oss/source/model/completes3uploadBody.ts`) & respons (`oss/source/model/signeds3uploadResponse.ts`) & transfer (`oss/source/custom-code/ossFileTransfer.ts`) | https://github.com/autodesk-platform-services/aps-sdk-node |
| 8 | Repo resmi — `aps-sdk-net`, `OssClient.UploadObjectAsync` (`oss/source/custom-code/OssClient.cs`) | https://github.com/autodesk-platform-services/aps-sdk-net |
