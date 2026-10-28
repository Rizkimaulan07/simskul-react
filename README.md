# SIMSKUL

**Sistem Informasi Manajemen Eskul** — aplikasi web fullstack untuk mengelola ekstrakurikuler sekolah: presensi, nilai, dokumentasi, perizinan, data anggota, laporan, dan manajemen data eskul.

Data disimpan di **PostgreSQL** (bukan lagi localStorage). Backend berupa server HTTP Node.js yang menyajikan API JSON sekaligus hasil build frontend (folder `dist/`).

## Menjalankan

### 1. Siapkan database PostgreSQL

Pastikan PostgreSQL berjalan, lalu buat database dan user aplikasi, misalnya:

```sql
CREATE DATABASE simskul;
CREATE ROLE simskul_app LOGIN PASSWORD '<password>';
GRANT ALL PRIVILEGES ON DATABASE simskul TO simskul_app;
```

Saat pertama dijalankan pada database yang masih kosong, backend otomatis membuat seluruh tabel dan mengisi data demo (3 eskul, 6 akun, 22 anggota, sesi, nilai, dokumentasi, perizinan).

### 2. Konfigurasi `.env`

Buat file `.env` pada root proyek:

```ini
# Koneksi PostgreSQL
DATABASE_URL=postgresql://simskul_app:<password>@localhost:5432/simskul

# Kata sandi awal administrator (hanya dipakai saat seeding database kosong)
SIMSKUL_ADMIN_PASSWORD=admin123

# Kata sandi awal akun demo pelatih & ketua
SIMSKUL_DEMO_PASSWORD=simskul123
```

File `.env` tidak ikut masuk repositori (sudah diatur di `.gitignore`).

### 3. Instal & jalankan

```bash
npm install
npm run dev      # backend :3001 + Vite (hot reload) sekaligus
```

Buka alamat yang ditampilkan Vite (biasanya `http://localhost:5173`).

Mode produksi:

```bash
npm run build    # type-check + build frontend ke dist/
npm run start    # server Node menyajikan API + dist pada :3001
```

Perintah lain:

```bash
npm run lint       # Oxlint
npm run typecheck  # tsc untuk client & server
```

## Akun demo (password `simskul123` kecuali admin)

| Peran | Email | Nama | Cakupan |
| --- | --- | --- | --- |
| Admin | admin@simskul.sch.id | Admin Sekolah | Semua eskul |
| Pelatih Eskul | budi@simskul.sch.id | Budi Santoso, S.Pd. | Pramuka |
| Ketua Eskul | rani@simskul.sch.id | Rani Puspita | Pramuka |

Kata sandi admin dapat diatur lewat `SIMSKUL_ADMIN_PASSWORD` saat database masih kosong.

## Peran & hak akses

Sistem memakai **tiga peran**: `admin`, `pelatih`, `ketua`.

**Admin** (sentral; menggantikan fungsi wakasek kesiswaan)
- Melihat ringkasan seluruh eskul, tren kehadiran global, dan aktivitas terbaru.
- **Mengelola data eskul**: menambah, mengedit, dan menghapus eskul — termasuk menunjuk pelatih dan ketua eskul.
- Manajemen pengguna (tambah user, ubah peran, tentukan tugas eskul).
- Menyetujui atau menolak perizinan dengan catatan keputusan.
- Laporan kehadiran, nilai, dan perizinan; ekspor CSV dan cetak.
- Galeri dokumentasi lintas eskul.

**Pelatih**
- Dashboard eskul, tren kehadiran, dan sesi terdekat.
- Membuat sesi, mengisi presensi, menandai kehadiran/berhalangan pelatih, dan mengekspor presensi ke CSV.
- Mengelola anggota (tambah/nonaktifkan) dan mengunggah dokumentasi.
- Mengisi nilai eskul (keaktifan 40%, sikap 30%, keterampilan 30%) serta catatan evaluasi.
- Mengajukan perizinan kegiatan.

**Ketua Eskul**
- Melihat dashboard, sesi, anggota, dokumentasi, dan perizinan eskulnya.
- **Mengisi presensi hanya ketika pelatih menandai berhalangan.** Setiap isian diberi label “Pengganti” dan mencatat nama ketua sebagai pengisi.
- Menambah anggota, mengunggah dokumentasi, dan mengajukan perizinan.
- Tidak dapat mengubah nilai.

Hak akses dijaga di tiga lapis: navigasi berbasis peran, guard rute (halaman 403), dan pemeriksaan peran di setiap endpoint API.

## Alur delegasi presensi

1. Pelatih membuka detail sesi dan menandai **Berhalangan**.
2. Sistem membuka presensi untuk ketua eskul pada sesi tersebut.
3. Ketua mengisi status anggota. Setiap entri menyimpan `updatedBy`, `asSubstitute`, dan waktu perubahan.
4. Pelatih tetap dapat mengoreksi isian; entri yang diisi pelatih tidak lagi berlabel pengganti.
5. Jejak audit terlihat pada daftar presensi, ekspor CSV, dan lini masa aktivitas.

## Teknologi

- React 19 + TypeScript (Vite 8, Tailwind CSS v4)
- React Router 7 (client-side routing)
- Zustand untuk state klien; sumber kebenaran tetap **API server**
- Backend HTTP Node.js (tanpa framework berat) di `server/`
- Driver **node-postgres (`pg`) + PostgreSQL**
- Recharts, Sonner, komponen UI bergaya shadcn (CVA + Lucide)

## Struktur utama

```text
src/                       # frontend
  App.tsx                  # rute, lazy loading, guard peran
  components/
    eskul/                 # dialog tambah/edit/hapus eskul
    layout/                # sidebar, topbar, shell responsif
    sessions/              # baris sesi, dialog buat sesi
    shared/ & ui/          # komponen dasar
  lib/
    types.ts               # tipe domain (Role: admin|pelatih|ketua)
    store.ts               # Zustand: auth + seluruh mutasi via API
    permissions.ts         # aturan izin per peran
  pages/                   # halaman per fitur
server/                    # backend
  index.ts                 # API JSON + penyajian dist/
  db.ts                    # pool PostgreSQL, skema, seeding
  security.ts              # hash kata sandi & sesi
scripts/dev.mjs            # menjalankan server + Vite bersamaan
```

## Ringkasan salah satu fitur baru: kelola eskul (admin)

- **Tambah eskul** dari halaman Data Eskul: nama, deskripsi, jadwal (hari + jam), kuota, warna tampilan, penunjukan pelatih & ketua.
- **Edit eskul** dari daftar atau detail; perubahan penunjukan otomatis menyinkronkan `eskul_id` pengguna terkait.
- **Hapus eskul** dengan konfirmasi; tugas pelatih/ketua pada eskul tersebut dilepas.

## Catatan

- Menjalankan `npm run start` membutuhkan `DATABASE_URL` yang valid; kesehatan koneksi dapat dicek di `GET /api/health`.

---

© 2026 SIMSKUL · Dibangun untuk kesiswaan yang lebih rapi.
