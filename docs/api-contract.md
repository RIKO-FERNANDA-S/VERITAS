# Kontrak API VERITAS (v1.0)

Dokumen ini adalah sumber kebenaran (single source of truth) untuk kontrak komunikasi antara Frontend dan Backend VERITAS.

---

## 1. Konvensi Umum

- **Format Data**: JSON (`application/json`), kecuali endpoint upload menggunakan `multipart/form-data`.
- **Otentikasi & Otorisasi**:
  - **Sisi Warga**: Tanpa akun. Akses menggunakan `access_token` (tautan unik) + kode 6 digit verifikasi. Disimpan ter-hash di DB, dibandingkan dengan `crypto.timingSafeEqual`.
  - **Sisi RT**: PIN 6 digit di-hash dengan `argon2id` (atau bcrypt), sesi disimpan via cookie `HttpOnly; Secure; SameSite=Strict`.
- **Anti-Enumerasi**: Respons untuk "tidak ditemukan", "token salah", dan "kode salah" menggunakan pesan identik:
  `{ "error": "Permintaan tidak ditemukan atau kode akses tidak valid" }` (HTTP 404/401).
- **Status Permintaan**:
  `dikirim` → `diperiksa` → `disetujui` → `surat_siap` | `ditolak`
- **Mode Tanda Tangan**:
  `otomatis` | `kosong`

---

## 2. Endpoint Warga

### 2.1 Mengirim Permintaan Surat Baru
- **Method**: `POST`
- **Path**: `/api/requests`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `letter_type`: `"pengantar_ktp" | "sktm" | "domisili"` (enum)
  - `request_text`: `string` (opsional / catatan pemohon, max 500 karakter)
  - `ktp_file`: `File` (opsional untuk pemohon KTP baru <17 tahun, wajib untuk jenis lain, max 5MB, format JPEG/PNG)
  - `kk_file`: `File` (wajib, max 5MB, format JPEG/PNG)
- **Response Success (201 Created)**:
  ```json
  {
    "id": "req_uuid_v4",
    "access_token": "string_hex_token",
    "access_code": "123456",
    "status": "dikirim",
    "letter_type": "pengantar_ktp",
    "created_at": "2026-11-24T22:00:00Z",
    "expires_at": "2026-12-01T22:00:00Z"
  }
  ```
- **Error Response (400 Bad Request)**:
  ```json
  {
    "error": "Validasi gagal",
    "details": [
      { "field": "kk_file", "message": "File Kartu Keluarga wajib diunggah" }
    ]
  }
  ```

---

### 2.2 Memeriksa Status Permintaan (Polling Warga)
- **Method**: `GET`
- **Path**: `/api/requests/:id?token=TOKEN&code=123456`
- **Response Success (200 OK)**:
  ```json
  {
    "id": "req_uuid_v4",
    "status": "dikirim | diperiksa | disetujui | surat_siap | ditolak",
    "letter_type": "pengantar_ktp",
    "created_at": "2026-11-24T22:00:00Z",
    "rejected_reason": "string | null",
    "download_url": "/api/requests/:id/download?token=TOKEN (hanya ada bila surat_siap)",
    "expires_at": "2026-12-01T22:00:00Z"
  }
  ```
- **Catatan Keamanan**: Nomor surat **TIDAK** disertakan di sini sebelum surat terbit secara sah.

---

## 3. Endpoint RT

### 3.1 Daftar Permintaan (Inbox RT)
- **Method**: `GET`
- **Path**: `/api/requests?status=STATUS&limit=20&cursor=CURSOR`
- **Auth**: Cookie Sesi RT
- **Query Params**:
  - `status`: `"semua" | "menunggu" | "disetujui" | "ditolak"` (default: diurutkan dari yang paling lama menunggu)
- **Response Success (200 OK)**:
  ```json
  {
    "items": [
      {
        "id": "req_uuid_v4",
        "letter_type": "pengantar_ktp",
        "status": "diperiksa",
        "pemohon_nama": "AHMAD SUBARJO",
        "pemohon_nik_masked": "3201••••••0001",
        "created_at": "2026-11-24T20:00:00Z",
        "findings_summary": {
          "blockers_count": 0,
          "warnings_count": 1
        }
      }
    ],
    "next_cursor": "string | null"
  }
  ```

---

### 3.2 Detail Permintaan & Hasil Diff (Layar Periksa)
- **Method**: `GET`
- **Path**: `/api/requests/:id`
- **Auth**: Cookie Sesi RT
- **Response Success (200 OK)**:
  ```json
  {
    "id": "req_uuid_v4",
    "status": "diperiksa",
    "letter_type": "pengantar_ktp",
    "request_text": "Permohonan pengantar KTP baru",
    "created_at": "2026-11-24T20:00:00Z",
    "extraction": {
      "ktp": {
        "nik": "3201010105900001",
        "nama": "AHMAD SUBARJO",
        "tempat_lahir": "BOGOR",
        "tanggal_lahir": "1990-05-01",
        "jenis_kelamin": "LAKI-LAKI",
        "alamat": "JL MAWAR NO 10",
        "rt": "002",
        "rw": "003",
        "kelurahan": "SUKAMAJU",
        "kecamatan": "CIBINONG",
        "agama": "ISLAM",
        "status_perkawinan": "KAWIN",
        "pekerjaan": "KARYAWAN SWASTA"
      },
      "kk": {
        "nomor_kk": "3201010101010001",
        "kepala_keluarga": "SUBARJO",
        "alamat": "JL MAWAR NO 10",
        "rt": "002",
        "rw": "003",
        "kelurahan": "SUKAMAJU",
        "kecamatan": "CIBINONG",
        "anggota": [
          {
            "nik": "3201010105900001",
            "nama": "AHMAD SUBARJO",
            "jenis_kelamin": "LAKI-LAKI",
            "tempat_lahir": "BOGOR",
            "tanggal_lahir": "1990-05-01",
            "agama": "ISLAM",
            "status_perkawinan": "KAWIN",
            "hubungan_keluarga": "ANAK"
          }
        ]
      }
    },
    "findings": [
      {
        "id": "find_1",
        "rule_id": "R04",
        "field": "nama",
        "severity": "warning",
        "ktp_value": "AHMAD SUBARJO",
        "kk_value": "ACHMAD SUBARJO",
        "message": "Typo nama 1 karakter antara KTP dan KK",
        "resolved": false
      }
    ],
    "can_approve": true,
    "has_signature": true,
    "signature_mode": "otomatis"
  }
  ```

---

### 3.3 Koreksi Field (Inline Edit RT)
- **Method**: `PATCH`
- **Path**: `/api/requests/:id/fields`
- **Auth**: Cookie Sesi RT
- **Request Body**:
  ```json
  {
    "source": "ktp | kk",
    "field": "nama",
    "new_value": "AHMAD SUBARJO",
    "override_choice": "use_ktp | use_kk | custom"
  }
  ```
- **Response Success (200 OK)**:
  Mengembalikan objek detail permintaan terbaru dengan aturan yang dihitung ulang (re-run engine).

---

### 3.4 Menyetujui Permintaan (Approve & Terbitkan)
- **Method**: `POST`
- **Path**: `/api/requests/:id/approve`
- **Auth**: Cookie Sesi RT
- **Request Body**:
  ```json
  {
    "signature_mode": "otomatis | kosong"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "status": "surat_siap",
    "letter_number": "470/012/2026/RT.02",
    "issued_at": "2026-11-24T22:30:00Z",
    "pdf_url": "/api/requests/:id/download"
  }
  ```
- **Error Response (422 Unprocessable Entity - Blocker Terbuka)**:
  ```json
  {
    "error": "Permintaan tidak dapat disetujui karena masih ada temuan berstatus blocker",
    "unresolved_blockers": [
      { "rule_id": "R01", "field": "nik", "message": "NIK tidak valid" }
    ]
  }
  ```

---

### 3.5 Menolak Permintaan (Reject)
- **Method**: `POST`
- **Path**: `/api/requests/:id/reject`
- **Auth**: Cookie Sesi RT
- **Request Body**:
  ```json
  {
    "reason": "NIK pemohon tidak terdaftar di KK yang dilampirkan dan alamat tidak sesuai dengan wilayah RT 02"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "status": "ditolak",
    "rejected_reason": "string",
    "rejected_at": "2026-11-24T22:30:00Z"
  }
  ```

---

### 3.6 Manajemen Tanda Tangan RT
- **POST `/api/rt/signature`**:
  - `multipart/form-data`: `file` (PNG transparan atau foto di kertas putih).
  - Server membersihkan background secara lokal menjadi transparan (threshold filter).
  - Mengarsipkan versi lama dan mengaktifkan versi baru.
- **DELETE `/api/rt/signature`**:
  - Menonaktifkan tanda tangan aktif.

---

## 4. Cron & Maintenance

### 4.1 Purge Dokumen Berkala
- **Method**: `POST`
- **Path**: `/api/cron/purge`
- **Headers**: `Authorization: Bearer <CRON_SECRET>`
- **Fungsi**: Menghapus dokumen foto fisik di storage privat yang `delete_after < NOW()`, serta menandai `purged_at`.
