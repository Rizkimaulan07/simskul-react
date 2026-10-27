# SIMSKUL

**Sistem Informasi Manajemen Eskul** — aplikasi web untuk mengelola ekstrakurikuler sekolah: presensi, nilai, dokumentasi, perizinan, data anggota, dan laporan.

Aplikasi ini adalah **MVP frontend** yang menyimpan seluruh data demo di `localStorage` browser. Tidak ada server maupun autentikasi password; akun demo dipilih langsung dari halaman masuk.

## Menjalankan

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite (biasanya `http://localhost:5173`).

Perintah lain:

```bash
npm run build    # type-check + build produksi
npm run preview  # menjalankan hasil build
npm run lint     # Oxlint
```

## Akun demo

| Peran | Nama | Cakupan |
| --- | --- | --- |
| Pelatih Eskul | Budi Santoso, S.Pd. | Pramuka |
| Ketua Eskul | Rani Puspita | Pramuka |
| Wakasek Kesiswaan | Sari Wulandari, M.Pd. | Semua eskul |

Data contoh mencakup 3 eskul (Pramuka, Futsal, Seni Tari), 22 anggota, sesi, nilai, dokumentasi, dan perizinan. Tanggal sesi dibuat relatif terhadap hari pertama data dimuat.

## Fitur per peran

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
- Tidak dapat mengubah nilai atau menyetujui perizinan.

**Wakasek Kesiswaan**
- Dashboard ringkasan seluruh eskul, tren kehadiran global, dan aktivitas terbaru.
- Melihat profil dan performa tiap eskul, seluruh sesi, serta galeri dokumentasi lintas eskul.
- Menyetujui atau menolak perizinan dengan catatan keputusan.
- Laporan kehadiran, nilai, dan perizinan; ekspor CSV dan cetak.

Hak akses dijaga di dua lapis: navigasi berbasis peran dan guard rute. Pelanggaran rute menampilkan halaman 403.

## Alur delegasi presensi

1. Pelatih membuka detail sesi dan menandai **Berhalangan**.
2. Sistem membuka presensi untuk ketua eskul pada sesi tersebut.
3. Ketua mengisi status anggota. Setiap entri menyimpan `updatedBy`, `asSubstitute`, dan waktu perubahan.
4. Pelatih tetap dapat mengoreksi isian; entri yang diisi pelatih tidak lagi berlabel pengganti.
5. Jejak audit terlihat pada daftar presensi, ekspor CSV, dan lini masa aktivitas.

## Teknologi

- React 19 + TypeScript
- Vite 8 + Tailwind CSS v4
- React Router 7 (`HashRouter`, cocok untuk hosting statis/PWA)
- Zustand + `persist` (`localStorage`)
- Recharts untuk grafik tren
- Sonner untuk notifikasi
- Komponen UI bergaya shadcn, dibuat manual dengan CVA dan Lucide

## Struktur utama

```text
src/
  App.tsx                 # rute, lazy loading, guard peran
  components/
    layout/               # sidebar, topbar, shell responsif
    sessions/             # baris sesi, dialog buat sesi
    shared/               # badge, stat card, empty state, dll.
    ui/                   # komponen dasar bergaya shadcn
  lib/
    seed.ts               # data demo
    store.ts              # Zustand: auth + seluruh mutasi
    permissions.ts        # aturan izin per peran
    selectors.ts          # agregasi presensi dan nilai
  pages/                  # halaman per fitur
```

## Reset data demo

Gunakan tombol **Pulihkan data demo** di halaman masuk. Data tersimpan dengan kunci `simskul-store-v1`; menghapus kunci tersebut dari `localStorage` juga akan mengembalikan kondisi awal.

## Catatan produksi

MVP ini belum memiliki backend. Untuk penggunaan nyata, diperlukan:

- Autentikasi dan otorisasi server-side (bukan hanya guard di klien).
- Basis data relasional untuk pengguna, eskul, anggota, sesi, presensi, nilai, dokumentasi, dan perizinan.
- Penyimpanan objek untuk foto dokumentasi (mis. S3/R2) beserta validasi dan kompresi gambar.
- API audit log yang tidak dapat diubah klien, khususnya untuk isian pengganti dan keputusan perizinan.
- Dukungan multi-tenant/multi-sekolah, pencadangan, serta kebijakan privasi data siswa.

---

© 2026 SIMSKUL · Dibangun untuk kesiswaan yang lebih rapi.
