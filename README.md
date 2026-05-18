# SIG-Pantau Tsunami

Sistem Informasi Geografis lokal untuk pemantauan anomali muka air laut, alert tsunami, otomasi sirine, evakuasi, audit log, dan simulasi drill.

## Fitur MVP

- Backend FastAPI dengan REST API dan WebSocket realtime.
- Frontend React + TypeScript bergaya command center GIS dengan peta tile OpenStreetMap/Leaflet, dashboard operasional, alert, evakuasi, aset, perangkat, simulasi, riwayat, audit, laporan, data master, dan pengaturan.
- PostgreSQL + PostGIS schema dan seed data untuk wilayah Panjang, Lampung.
- Engine deteksi anomali berbasis moving median, baseline, delta, rate, z-score, confidence, dan konfirmasi multi-sensor.
- Warning fullscreen saat level `AWAS`.
- Sirine dummy otomatis ON saat `AWAS`, dengan audit log.
- Fallback frontend dari WebSocket ke polling.

## Cara Menjalankan

```bash
docker compose up --build
```

Layanan:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- PostgreSQL: localhost:5432

## Mode Demo Cepat

1. Buka http://localhost:5173
2. Masuk halaman `Simulasi & Drill`.
3. Pilih skenario `Air Naik Cepat` atau geser slider hingga ekstrem.
4. Saat level menjadi `AWAS`, overlay darurat fullscreen tampil dan sirine dummy aktif.
5. Klik `Acknowledge Operator` untuk mengecilkan peringatan tanpa kehilangan status darurat.
6. Gunakan `Resolve Alert (Supervisor)` dengan PIN supervisor/admin setelah simulasi atau kondisi aman.

## Akun Demo

- Operator: `operator` / PIN `111111`
- Supervisor: `supervisor` / PIN `222222`
- Admin: `admin` / PIN `333333`

## Struktur

- `backend/` FastAPI service, anomaly engine, realtime stream.
- `frontend/` React TypeScript UI.
- `db/` schema PostGIS dan seed data.
- `docker-compose.yml` stack lokal end-to-end.

## Catatan Keselamatan

Ini MVP simulasi lokal untuk demonstrasi dan pengembangan. Integrasi operasional nyata wajib memakai sensor tervalidasi, prosedur otorisasi resmi, redundancy komunikasi, dan sertifikasi instansi berwenang.
