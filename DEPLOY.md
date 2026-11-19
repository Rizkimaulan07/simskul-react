# Deploy Gratis — Render + Neon

Panduan ini memasang SIMSKUL secara online **tanpa biaya** dan **tanpa kartu kredit**:

- **Render** (Web Service, plan Free) menjalankan backend Node.js sekaligus menyajikan frontend hasil build.
- **Neon** (PostgreSQL, plan Free) menyimpan seluruh data: akun, eskul, presensi, nilai, dokumentasi, surat izin, prestasi, dan logo.

Kode aplikasi tidak perlu diubah. Konfigurasi Render sudah disiapkan di [`render.yaml`](./render.yaml), dan versi Node dikunci lewat [`.node-version`](./.node-version).

> Biaya gratis ini cocok untuk demo, tugas, atau uji coba. Untuk data sekolah sungguhan, baca bagian [Batasan & tips](#batasan--tips) di bawah.

---

## Ringkasan alur

1. Buat database PostgreSQL gratis di Neon.
2. Deploy repo GitHub ini ke Render lewat Blueprint.
3. Isi `DATABASE_URL` dan kata sandi awal.
4. Buka URL `*.onrender.com` dan masuk sebagai admin.

Perkiraan waktu: **10–15 menit** (sebagian besar menunggu build pertama).

---

## 1. Buat database di Neon

1. Buka <https://neon.com/signup> lalu daftar dengan GitHub atau Google. Neon Free tidak meminta kartu kredit.
2. Klik **Create project**.
   - **Name**: `simskul`
   - **Postgres version**: pilih versi terbaru yang tersedia (17 atau 18).
   - **Region**: **AWS ap-southeast-1 (Singapore)** — pilih region yang sama dengan Render nanti agar cepat.
3. Setelah project dibuat, klik **Connect** di dashboard Neon.
4. Aktifkan **Connection pooling** (opsional tetapi disarankan), lalu salin **connection string** yang bentuknya seperti:

   ```text
   postgresql://neondb_owner:xxxxxxxx@ep-nama-project-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   Simpan string ini. Jangan di-commit ke Git dan jangan dibagikan ke publik.
5. Tidak perlu membuat tabel secara manual. Saat pertama kali dijalankan, SIMSKUL otomatis membuat skema dan mengisi data demo (17 eskul, 36 akun, 134 anggota, dll.).

> Jika nanti koneksi gagal dengan pesan soal `channel_binding`, hapus bagian `&channel_binding=require` dari URL dan simpan ulang.

---

## 2. Deploy ke Render

### Cara termudah: Blueprint

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Rizkimaulan07/simskul-react)

1. Buka <https://dashboard.render.com/register>, daftar dengan GitHub (gratis, tanpa kartu kredit).
2. Buka <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
3. Hubungkan akun GitHub, lalu pilih repository:

   ```text
   Rizkimaulan07/simskul-react
   ```

   Branch: `main`.
4. Render akan membaca `render.yaml` dan menampilkan satu service bernama **simskul** dengan plan **Free** di region **Singapore**.
5. Isi variabel yang diminta:

   | Variabel | Nilai |
   | --- | --- |
   | `DATABASE_URL` | Connection string Neon dari langkah 1 (pakai yang `-pooler` bila ada). |
   | `SIMSKUL_ADMIN_PASSWORD` | Kata sandi baru yang kuat untuk `admin@simskul.sch.id`. |
   | `SIMSKUL_DEMO_PASSWORD` | Kata sandi baru untuk seluruh akun demo (pelatih, ketua, wakasek). |

   `SIMSKUL_COOKIE_SECURE=1` sudah diatur otomatis oleh Blueprint karena Render memakai HTTPS.
6. Klik **Apply** / **Deploy Blueprint**. Tunggu build pertama selesai (sekitar 3–8 menit).
7. Setelah status **Live**, buka:

   ```text
   https://simskul.onrender.com
   ```

   (atau nama lain yang tampil di dashboard Render). Cek juga:

   ```text
   https://simskul.onrender.com/api/health
   ```

   Respons yang benar berisi `"ok": true`.

### Jika memilih manual (tanpa Blueprint)

Di dashboard Render: **New** → **Web Service** → pilih repo → isi:

| Pengaturan | Nilai |
| --- | --- |
| Language / Runtime | Node |
| Region | Singapore |
| Branch | `main` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Instance Type / Plan | Free |

Tambahkan environment variable yang sama seperti tabel di atas, lalu deploy.

---

## 3. Masuk dan ganti kata sandi

Gunakan akun admin:

- **Email**: `admin@simskul.sch.id`
- **Kata sandi**: nilai `SIMSKUL_ADMIN_PASSWORD` yang kamu isi di Render.

Akun demo lain memakai `SIMSKUL_DEMO_PASSWORD`, misalnya:

| Peran | Email |
| --- | --- |
| Wakasek | `wakasek@simskul.sch.id` |
| Pelatih Pramuka | `budi@simskul.sch.id` |
| Ketua Pramuka | `rani@simskul.sch.id` |

> Kata sandi hanya dipakai saat database **masih kosong**. Jika kamu mengubah environment variable setelah data demo ter-seed, kata sandi lama tidak ikut berubah. Ganti lewat halaman **Profil & Keamanan** di aplikasi.

---

## 4. Pembaruan otomatis

Setiap `git push` ke branch `main` akan memicu deploy ulang di Render (`autoDeployTrigger: commit`). Skema database dicek dan dimigrasikan otomatis saat server mulai, jadi data yang sudah ada tetap aman.

Untuk deploy manual: buka service di dashboard Render → **Manual Deploy** → **Deploy latest commit**.

---

## 5. Opsional: mengurangi cold start

Service Free Render **tidur setelah 15 menit tanpa traffic** dan butuh sekitar 1 menit untuk bangun saat dibuka lagi. Jika tidak masalah, biarkan saja.

Jika ingin tetap hangat, buat monitor HTTP gratis di [cron-job.org](https://cron-job.org) atau [UptimeRobot](https://uptimerobot.com) yang memanggil:

```text
https://simskul.onrender.com/api/health
```

setiap **10–14 menit**. Render Free memberi 750 jam instance per bulan; satu service yang aktif terus masih berada di bawah kuota tersebut (sekitar 744 jam per 31 hari). Jangan membuat lebih dari satu service gratis yang selalu aktif.

---

## 6. Alternatif host berbasis Docker

Repo ini juga menyertakan [`Dockerfile`](./Dockerfile) untuk host gratis lain yang mendukung Docker, misalnya **Koyeb** atau **Hugging Face Spaces**. Yang perlu diatur:

- Port aplikasi mengikuti environment variable `PORT` (default `3001`). Jika platform meminta port tertentu, set `PORT` sesuai.
- Set `DATABASE_URL`, `SIMSKUL_ADMIN_PASSWORD`, `SIMSKUL_DEMO_PASSWORD`, dan `SIMSKUL_COOKIE_SECURE=1` (untuk HTTPS).
- Gunakan database Neon yang sama.

Render tetap menjadi opsi yang paling sedikit konfigurasi karena `render.yaml` sudah menyiapkan semuanya.

---

## Batasan & tips

**Render Free**

- 512 MB RAM, 0.1 CPU, satu instance.
- Tidur setelah 15 menit idle; request pertama bisa lambat.
- Filesystem sementara, tetapi **tidak masalah** karena gambar dokumentasi dan logo disimpan di PostgreSQL, bukan di disk.
- 750 jam instance per bulan; service yang selalu dipanggil 24/7 masih masuk kuota.

**Neon Free**

- 1 GB storage per project, 100 CU-hours per bulan.
- Compute otomatis suspend setelah 5 menit idle dan bangun dalam hitungan detik saat ada query.
- Data tidak dihapus saat kena limit; penulisan baru diblokir sampai bulan berikutnya atau upgrade.
- Riwayat pemulihan (instant restore) hanya 6 jam. Lakukan backup berkala dengan `pg_dump`:

  ```bash
  pg_dump "postgresql://.../neondb?sslmode=require" -Fc -f simskul-backup.dump
  ```

- Upload gambar dibatasi 6 MB per file. Karena gambar ikut tersimpan di database, hindari mengunggah banyak foto besar agar kuota 1 GB tidak cepat penuh.

**Keamanan**

- Jangan gunakan kata sandi demo/default untuk data sungguhan.
- Jangan commit `.env` atau connection string Neon ke GitHub.
- Untuk penggunaan serius, pertimbangkan upgrade database/renderer berbayar, tambahkan backup rutin, dan tinjau ulang batas upload.

---

## Troubleshooting

| Gejala | Solusi |
| --- | --- |
| Build gagal di Render | Buka **Logs**. Pastikan build command memakai `npm ci --include=dev` dan file `.node-version` ikut ter-push. |
| `password authentication failed` / `ECONNREFUSED` | Salin ulang connection string Neon. Jika kata sandi mengandung karakter khusus (`@`, `#`, `/`), URL-encode karakter tersebut. |
| Error SSL / sertifikat | Pastikan URL diakhiri `?sslmode=require`. Untuk Neon, gunakan host `-pooler` bila connection pooling aktif. |
| Login berhasil tetapi langsung terlempar lagi | Pastikan `SIMSKUL_COOKIE_SECURE=1` hanya dipakai di HTTPS. Untuk akses HTTP lokal, set `0` atau hapus variabelnya. |
| Halaman pertama lama / 502 sesaat | Service Free sedang bangun dari tidur. Tunggu ±1 menit lalu muat ulang. |
| Data ter-reset setelah deploy | Data tidak disimpan di disk Render. Pastikan `DATABASE_URL` menunjuk ke Neon dan tidak berubah antar-deploy. |
| `channel_binding` error | Hapus `&channel_binding=require` dari `DATABASE_URL`. |

---

Setelah selesai, simpan URL Render dan kredensial database di tempat aman. Selamat mencoba!
