# SIMSKUL

**Sistem Informasi Manajemen Eskul** — aplikasi web fullstack untuk mengelola ekstrakurikuler sekolah: presensi, nilai, dokumentasi, surat izin kegiatan, kalender kegiatan, prestasi, data anggota, laporan, profil & keamanan akun, serta manajemen data eskul.

Data disimpan di **PostgreSQL** (bukan lagi localStorage). Backend berupa server HTTP Node.js yang menyajikan API JSON sekaligus hasil build frontend (folder `dist/`).

## Menjalankan

### 1. Siapkan database PostgreSQL

Pastikan PostgreSQL berjalan, lalu buat database dan user aplikasi, misalnya:

```sql
CREATE DATABASE simskul;
CREATE ROLE simskul_app LOGIN PASSWORD '<password>';
GRANT ALL PRIVILEGES ON DATABASE simskul TO simskul_app;
```

Saat pertama dijalankan pada database yang masih kosong, backend otomatis membuat seluruh tabel dan mengisi data demo (17 eskul, 36 akun, 134 anggota, sesi, nilai, dokumentasi, surat izin, dan prestasi eskul).

### 2. Konfigurasi `.env`

Buat file `.env` pada root proyek:

```ini
# Koneksi PostgreSQL
DATABASE_URL=postgresql://simskul_app:<password>@localhost:5432/simskul

# Kata sandi awal administrator (hanya dipakai saat seeding database kosong)
SIMSKUL_ADMIN_PASSWORD=admin123

# Kata sandi awal akun demo pelatih, ketua & wakasek
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
| Wakasek Kesiswaan | wakasek@simskul.sch.id | Dewi Kartika, M.Pd. | Surat izin yang disetujui |
| Pelatih Eskul | budi@simskul.sch.id | Budi Santoso, S.Pd. | Pramuka |
| Ketua Eskul | rani@simskul.sch.id | Rani Puspita | Pramuka |

Kata sandi admin dapat diatur lewat `SIMSKUL_ADMIN_PASSWORD` saat database masih kosong.

Setiap eskul memiliki satu akun pelatih dan satu akun ketua. Pola emailnya adalah `pelatih.<slug>@simskul.sch.id` dan `ketua.<slug>@simskul.sch.id` (contoh: `pelatih.andro-it@simskul.sch.id`), dengan kata sandi demo `simskul123`.

## Peran & hak akses

Sistem memakai **empat peran**: `admin`, `pelatih`, `ketua`, `wakasek`.

**Admin**
- Melihat ringkasan seluruh eskul, tren kehadiran global, dan aktivitas terbaru.
- **Mengelola data eskul**: menambah, mengedit, dan menghapus eskul — termasuk menunjuk pelatih dan ketua eskul.
- Manajemen pengguna (tambah user, ubah peran, tentukan tugas eskul).
- Menyetujui atau menolak pengajuan surat izin dengan catatan keputusan.
- Laporan kehadiran, nilai, dan surat izin; ekspor CSV dan cetak.
- Galeri dokumentasi lintas eskul.
- Kalender kegiatan lintas eskul serta pencatatan prestasi dari tingkat sekolah hingga internasional.
- Profil & keamanan akun, termasuk perubahan kata sandi.

**Pelatih**
- Dashboard eskul, tren kehadiran, dan sesi terdekat.
- Membuat sesi, mengisi presensi anggota serta kehadiran pelatih dan ketua eskul, lalu mengekspor presensi ke CSV.
- Mengelola anggota (tambah/nonaktifkan) dan mengunggah dokumentasi.
- Mengisi nilai eskul (keaktifan 40%, sikap 30%, keterampilan 30%) serta catatan evaluasi.
- Mengajukan surat izin kegiatan sekaligus melengkapi isi suratnya.
- Melihat kalender kegiatan eskul, mencatat prestasi, dan memperbarui profil/kata sandi.

**Ketua Eskul**
- Melihat dashboard, sesi, anggota, dokumentasi, dan surat izin eskulnya.
- **Mengisi presensi anggota dan kehadiran dirinya hanya ketika pelatih menandai berhalangan.** Setiap isian anggota diberi label “Pengganti” dan mencatat nama ketua sebagai pengisi.
- Menambah anggota, mengunggah dokumentasi, dan mengajukan surat izin.
- Melihat kalender, mencatat prestasi eskul, serta mengelola profil akun.
- Tidak dapat mengubah nilai.

**Wakasek Kesiswaan**
- Langsung diarahkan ke daftar **Surat Izin** setelah masuk.
- Hanya melihat surat dari pengajuan yang sudah **disetujui** atau **selesai**.
- Mencetak surat A4 dan menandatanganinya secara basah pada kolom wakasek.
- Menerima pusat notifikasi surat izin serta dapat memperbarui profil dan kata sandi.
- Tidak dapat mengubah data eskul, presensi, nilai, maupun isi surat.

Hak akses dijaga di tiga lapis: navigasi berbasis peran, guard rute (halaman 403), dan pemeriksaan peran di setiap endpoint API.

## Presensi pelatih & ketua

Daftar presensi pada detail sesi memuat dua kelompok: **pelatih & ketua** serta **anggota eskul**.

- Pelatih dan ketua memiliki status `hadir`, `izin`, `sakit`, atau `alpa` seperti anggota.
- Status pelatih sekaligus menjadi penentu delegasi: `hadir` mengunci presensi ketua, sedangkan status lain membuka akses presensi untuk ketua.
- Pelatih dapat mengoreksi kehadiran dirinya dan ketua. Ketua hanya dapat mengisi kehadirannya sendiri saat pelatih berhalangan.
- Administrator tetap dapat meninjau seluruh isian, tetapi tidak dapat mengubah presensi.
- Rekap statistik dan laporan tetap menghitung kehadiran anggota; kehadiran pelatih/ketua tersimpan sebagai data pembina pada sesi.

## Alur delegasi presensi

1. Pelatih membuka detail sesi dan mengisi kehadiran dirinya. Status selain **Hadir** otomatis membuka presensi untuk ketua eskul.
2. Sistem membuka presensi anggota dan kehadiran ketua pada sesi tersebut.
3. Ketua mengisi status anggota dan kehadiran dirinya. Setiap entri anggota menyimpan `updatedBy`, `asSubstitute`, dan waktu perubahan.
4. Pelatih tetap dapat mengoreksi isian; entri anggota yang diisi pelatih tidak lagi berlabel pengganti.
5. Jejak audit terlihat pada daftar presensi, ekspor CSV, dan lini masa aktivitas.

## Kalender kegiatan

Halaman **Kalender Kegiatan** menyatukan seluruh agenda eskul dalam tampilan bulanan:

- Sesi latihan (hijau), rentang surat izin (biru), dan prestasi (kuning) tampil langsung pada tanggalnya.
- Navigasi bulan sebelumnya/berikutnya, tombol **Hari ini**, serta filter jenis agenda dan eskul (khusus admin).
- Klik tanggal untuk membuka agenda harian berisi waktu, lokasi, status izin, dan tautan ke detail sesi/surat.
- Pelatih dapat menjadwalkan sesi langsung dari tanggal yang dipilih; dialog otomatis memakai tanggal tersebut.

## Prestasi eskul

Halaman **Prestasi Eskul** mendokumentasikan capaian anggota:

- Tingkat kompetisi: sekolah, kecamatan, kota, provinsi, nasional, dan internasional.
- Peringkat: Juara 1–3, Harapan 1–3, atau Peserta, lengkap dengan nama peserta dan deskripsi.
- Ringkasan jumlah prestasi, podium, capaian nasional+, dan eskul berprestasi.
- Filter peringkat, tingkat, eskul (admin), dan pencarian; data dapat diekspor ke CSV.
- Pelatih/ketua mencatat prestasi eskulnya sendiri, admin dapat mengelola seluruh eskul. Prestasi juga muncul di kalender, dashboard, dan pusat notifikasi.

## Pusat notifikasi & profil

- **Pusat notifikasi** di topbar merangkum pengingat yang relevan per peran: surat izin menunggu keputusan, surat siap ditandatangani, presensi hari ini, presensi yang dititipkan ke ketua, keputusan izin, dan prestasi baru. Status “sudah dibaca” disimpan per pengguna di perangkat.
- **Profil & Keamanan** dapat dibuka dari avatar di topbar atau kartu pengguna di sidebar. Pengguna dapat mengubah nama, email, nomor telepon, serta kata sandi.
- Perubahan kata sandi memverifikasi kata sandi lama, minimal 8 karakter, dan otomatis mengakhiri sesi di perangkat lain sementara sesi saat ini tetap aktif.
- Halaman profil juga menampilkan peran, cakupan eskul, status akun, dan lima aktivitas terakhir pengguna.

## Surat izin kegiatan

Halaman **Surat Izin** menggantikan menu Perizinan: pembuatan pengajuan, persetujuan admin, dan pencetakan surat dilakukan di satu tempat. Setiap pengajuan otomatis memiliki satu surat izin (`permit_letters`, relasi 1:1).

1. Pelatih atau ketua membuat pengajuan dari halaman Surat Izin. Sistem langsung menyusun draf surat dari data kegiatan, eskul, ketua, dan jumlah anggota.
2. Pengelola eskul dapat mengubah nomor, tempat/tanggal, tujuan, perihal, isi surat, jumlah peserta, lampiran, serta nama dan jabatan penanda tangan selama status masih **diajukan**.
3. Admin memeriksa pratinjau surat dan memutuskan pengajuan. Admin tidak mengubah isi surat.
4. Setelah **disetujui**, surat hanya dapat dilihat dan dicetak. Wakasek melihat daftar surat yang siap ditandatangani, mencetaknya dalam ukuran A4, lalu membubuhkan tanda tangan basah.
5. Surat berstatus draf atau ditolak diberi tanda air (watermark) agar tidak tertukar dengan dokumen final.

Tombol **Template awal** mengembalikan isi surat ke susunan bawaan tanpa langsung menyimpannya. Nomor surat otomatis memakai pola `001/EKSKUL/<KODE>/<BULAN ROMAWI>/<TAHUN>`.

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
    layout/                # sidebar, topbar, pusat notifikasi, shell responsif
    sessions/              # baris sesi, dialog buat sesi
    shared/ & ui/          # komponen dasar
  lib/
    types.ts               # tipe domain (Role: admin|pelatih|ketua|wakasek)
    permit-letter.ts       # template & nomor surat izin
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
- **Buat akun pelatih/ketua langsung dari form eskul** melalui tombol “Akun baru” di samping pilihan pelatih atau ketua. Akun dibuat saat form disimpan dan langsung tertaut ke eskul tersebut.
- **Edit eskul** dari daftar atau detail; perubahan penunjukan otomatis menyinkronkan `eskul_id` pengguna terkait.
- **Hapus eskul** dengan konfirmasi; tugas pelatih/ketua pada eskul tersebut dilepas.

## Catatan

- Menjalankan `npm run start` membutuhkan `DATABASE_URL` yang valid; kesehatan koneksi dapat dicek di `GET /api/health`.

---

© 2026 SIMSKUL · Dibangun untuk kesiswaan yang lebih rapi.
