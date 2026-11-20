<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

class AttendanceService
{
    private BaseConnection $db;

    private const HARI = [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu', 7 => 'minggu'];

    public function __construct()
    {
        $this->db = db_connect();
    }

    // ---------- data pendukung ----------

    public function jadwal(): array
    {
        return $this->db->table('jadwal_kerja')->orderBy('is_default', 'DESC')->orderBy('id')->get(1)->getRowArray()
            ?? ['jam_masuk' => '08:00:00', 'jam_pulang' => '17:00:00', 'toleransi_menit' => 0, 'hari_kerja' => 'senin,selasa,rabu,kamis,jumat'];
    }

    public function lokasi(): ?array
    {
        return $this->db->table('lokasi_absensi')->where('aktif', 1)->orderBy('id')->get(1)->getRowArray();
    }

    /** Minimal durasi kerja (menit) sebelum boleh check-out. Default 480 (8 jam). Diatur lewat tabel pengaturan. */
    public function minDurasiMenit(): int
    {
        $row = $this->db->table('pengaturan')->where('key', 'absensi.min_durasi_menit')->get()->getRowArray();
        if ($row) {
            $nilai = json_decode($row['value_json'], true);
            if (is_numeric($nilai) && $nilai >= 0) {
                return (int) $nilai;
            }
        }
        return 480;
    }

    private function absensi(int $karyawanId, string $tanggal): ?array
    {
        return $this->db->table('absensi')->where('karyawan_id', $karyawanId)->where('tanggal', $tanggal)->get()->getRowArray();
    }

    private function jam(?string $t): ?string
    {
        return $t === null ? null : substr($t, 0, 5);
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r    = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a    = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return 2 * $r * asin(sqrt($a));
    }

    /** @return array{error?: array, dalam?: ?bool} */
    private function evaluasiLokasi(?array $lokasi, $lat, $lng): array
    {
        if (! $lokasi) {
            return ['error' => ['LOCATION_NOT_CONFIGURED', 'Lokasi kerja belum diatur. Hubungi admin HRD', 409, null]];
        }

        $wajib = (int) $lokasi['wajib_lokasi'] === 1;
        $punya = is_numeric($lat) && is_numeric($lng);

        if ($punya && (abs((float) $lat) > 90 || abs((float) $lng) > 180)) {
            return ['error' => ['VALIDATION_ERROR', 'Data tidak valid', 422, ['latitude' => 'Koordinat tidak valid']]];
        }
        if (! $punya) {
            return $wajib
                ? ['error' => ['VALIDATION_ERROR', 'Data tidak valid', 422, ['latitude' => 'Lokasi wajib dikirim. Aktifkan izin lokasi di browser']]]
                : ['dalam' => null];
        }

        $jarak = $this->haversine((float) $lat, (float) $lng, (float) $lokasi['latitude'], (float) $lokasi['longitude']);
        $dalam = $jarak <= (int) $lokasi['radius_meter'];

        if (! $dalam && $wajib) {
            return ['error' => ['OUTSIDE_RADIUS', 'Anda berada di luar radius lokasi kerja (' . round($jarak) . ' m dari kantor)', 422, null]];
        }
        return ['dalam' => $dalam];
    }

    // ---------- endpoint karyawan ----------

    public function hariIni(int $karyawanId): array
    {
        $now     = new \DateTimeImmutable('now');
        $tanggal = $now->format('Y-m-d');
        $jadwal  = $this->jadwal();
        $lokasi  = $this->lokasi();
        $abs     = $this->absensi($karyawanId, $tanggal);

        $min         = $this->minDurasiMenit();
        $pulangCepat = ($abs && $abs['jam_masuk'] !== null)
            ? (new \DateTimeImmutable($tanggal . ' ' . $abs['jam_masuk']))->modify('+' . $min . ' minutes')
            : null;

        return [
            'tanggal'     => $tanggal,
            'server_time' => $now->format('c'),
            'jam_kerja'   => [
                'masuk'           => $this->jam($jadwal['jam_masuk']),
                'pulang'          => $this->jam($jadwal['jam_pulang']),
                'toleransi_menit' => (int) $jadwal['toleransi_menit'],
            ],
            'lokasi_kantor' => $lokasi ? [
                'nama'         => $lokasi['nama'],
                'alamat'       => $lokasi['alamat'],
                'latitude'     => (float) $lokasi['latitude'],
                'longitude'    => (float) $lokasi['longitude'],
                'radius_meter' => (int) $lokasi['radius_meter'],
                'wajib_lokasi' => (bool) $lokasi['wajib_lokasi'],
            ] : null,
            'absensi' => $abs ? [
                'id'              => (int) $abs['id'],
                'jam_masuk'       => $abs['jam_masuk'],
                'jam_pulang'      => $abs['jam_pulang'],
                'status'          => $abs['status'],
                'menit_terlambat' => (int) $abs['menit_terlambat'],
                'lokasi_masuk'    => [
                    'latitude'     => $abs['lokasi_masuk_lat'] !== null ? (float) $abs['lokasi_masuk_lat'] : null,
                    'longitude'    => $abs['lokasi_masuk_lng'] !== null ? (float) $abs['lokasi_masuk_lng'] : null,
                    'dalam_radius' => $abs['dalam_radius'] !== null ? (bool) $abs['dalam_radius'] : null,
                ],
            ] : null,
            'bisa_absen_masuk'    => $abs === null,
            'bisa_absen_pulang'   => $abs !== null && $abs['jam_masuk'] !== null && $abs['jam_pulang'] === null && $now >= $pulangCepat,
            'min_durasi_menit'    => $min,
            'pulang_paling_cepat' => $pulangCepat?->format('c'),
        ];
    }

    public function checkIn(int $karyawanId, $lat, $lng): array
    {
        $now     = new \DateTimeImmutable('now');
        $tanggal = $now->format('Y-m-d');
        $jam     = $now->format('H:i:s');

        $abs = $this->absensi($karyawanId, $tanggal);
        if ($abs) {
            return $abs['jam_masuk'] !== null
                ? ['error' => ['ALREADY_CHECKED_IN', 'Anda sudah absen masuk hari ini', 409, null]]
                : ['error' => ['CONFLICT', 'Hari ini Anda tercatat ' . $abs['status'], 409, null]];
        }

        $lokasi = $this->lokasi();
        $ev     = $this->evaluasiLokasi($lokasi, $lat, $lng);
        if (isset($ev['error'])) {
            return $ev;
        }

        $jadwal    = $this->jadwal();
        $selisih   = $now->getTimestamp() - strtotime($tanggal . ' ' . $jadwal['jam_masuk']);
        $terlambat = $selisih > ((int) $jadwal['toleransi_menit']) * 60;
        $menit     = $terlambat ? intdiv($selisih, 60) : 0;
        $status    = $terlambat ? 'terlambat' : 'hadir';
        $ts        = $now->format('Y-m-d H:i:s');

        $this->db->table('absensi')->insert([
            'karyawan_id'       => $karyawanId,
            'tanggal'           => $tanggal,
            'jam_masuk'         => $jam,
            'status'            => $status,
            'menit_terlambat'   => $menit,
            'lokasi_masuk_lat'  => is_numeric($lat) ? $lat : null,
            'lokasi_masuk_lng'  => is_numeric($lng) ? $lng : null,
            'dalam_radius'      => $ev['dalam'] === null ? null : (int) $ev['dalam'],
            'lokasi_absensi_id' => $lokasi['id'] ?? null,
            'sumber'            => 'web',
            'created_at'        => $ts,
            'updated_at'        => $ts,
        ]);

        return ['data' => [
            'id'              => (int) $this->db->insertID(),
            'tanggal'         => $tanggal,
            'jam_masuk'       => $jam,
            'status'          => $status,
            'menit_terlambat' => $menit,
        ]];
    }

    public function checkOut(int $karyawanId, $lat, $lng): array
    {
        $now     = new \DateTimeImmutable('now');
        $tanggal = $now->format('Y-m-d');

        $abs = $this->absensi($karyawanId, $tanggal);
        if (! $abs || $abs['jam_masuk'] === null) {
            return ['error' => ['NOT_CHECKED_IN', 'Anda belum absen masuk hari ini', 409, null]];
        }
        if ($abs['jam_pulang'] !== null) {
            return ['error' => ['ALREADY_CHECKED_OUT', 'Anda sudah absen pulang hari ini', 409, null]];
        }

        // Minimal durasi kerja sebelum boleh pulang (dapat diatur lewat tabel pengaturan)
        $min   = $this->minDurasiMenit();
        $sudah = intdiv($now->getTimestamp() - strtotime($tanggal . ' ' . $abs['jam_masuk']), 60);
        if ($sudah < $min) {
            $sisa = $min - $sudah;
            return ['error' => ['MIN_DURATION_NOT_MET', sprintf('Belum bisa absen pulang. Sisa waktu kerja minimal: %d jam %d menit', intdiv($sisa, 60), $sisa % 60), 422, null]];
        }

        $ev = $this->evaluasiLokasi($this->lokasi(), $lat, $lng);
        if (isset($ev['error'])) {
            return $ev;
        }

        $jadwal = $this->jadwal();
        $durasi = max(0, intdiv($now->getTimestamp() - strtotime($tanggal . ' ' . $abs['jam_masuk']), 60));
        $lembur = (int) ($abs['lembur_menit'] ?? 0); // lembur hanya dari pengajuan lembur yang disetujui (kontrak)
        $jam    = $now->format('H:i:s');

        $this->db->table('absensi')->where('id', $abs['id'])->update([
            'jam_pulang'        => $jam,
            'durasi_menit'      => $durasi,
            'lembur_menit'      => $lembur,
            'lokasi_pulang_lat' => is_numeric($lat) ? $lat : null,
            'lokasi_pulang_lng' => is_numeric($lng) ? $lng : null,
            'updated_at'        => $now->format('Y-m-d H:i:s'),
        ]);

        return ['data' => [
            'id'               => (int) $abs['id'],
            'jam_masuk'        => $abs['jam_masuk'],
            'jam_pulang'       => $jam,
            'durasi_menit'     => $durasi,
            'jam_lembur_menit' => $lembur,
        ]];
    }

    public function riwayat(int $karyawanId, string $periode, int $page, int $perPage): array
    {
        $awal  = $periode . '-01';
        $akhir = date('Y-m-t', strtotime($awal));

        $rows = $this->db->table('absensi')
            ->where('karyawan_id', $karyawanId)
            ->where('tanggal >=', $awal)->where('tanggal <=', $akhir)
            ->orderBy('tanggal', 'DESC')->get()->getResultArray();

        $ringkasan = ['hari_kerja' => $this->hitungHariKerja($awal, $akhir),
            'hadir' => 0, 'terlambat' => 0, 'izin' => 0, 'sakit' => 0, 'cuti' => 0, 'alpha' => 0];
        foreach ($rows as $r) {
            if (in_array($r['status'], ['hadir', 'terlambat', 'izin', 'sakit', 'cuti', 'alpha'], true)) {
                $ringkasan[$r['status']]++;
            }
        }

        $kalender = array_map(static fn ($r) => ['tanggal' => $r['tanggal'], 'status' => $r['status']], array_reverse($rows));

        $total   = count($rows);
        $slice   = array_slice($rows, ($page - 1) * $perPage, $perPage);
        $riwayat = array_map(fn ($r) => [
            'id'                   => (int) $r['id'],
            'tanggal'              => $r['tanggal'],
            'jam_masuk'            => $this->jam($r['jam_masuk']),
            'jam_pulang'           => $this->jam($r['jam_pulang']),
            'durasi_menit'         => $r['durasi_menit'] !== null ? (int) $r['durasi_menit'] : null,
            'status'               => $r['status'],
            'koreksi_pengajuan_id' => $r['pengajuan_id'] !== null ? (int) $r['pengajuan_id'] : null,
        ], $slice);

        return [
            'data' => ['periode' => $periode, 'ringkasan' => $ringkasan, 'kalender' => $kalender, 'riwayat' => $riwayat],
            'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => max(1, (int) ceil($total / $perPage))],
        ];
    }

    /** Hitung hari kerja menurut jadwal default, dikurangi hari libur. */
    public function hitungHariKerja(string $awal, string $akhir): int
    {
        $hariKerja = array_map('trim', explode(',', strtolower($this->jadwal()['hari_kerja'])));
        $libur     = array_column(
            $this->db->table('hari_libur')->select('tanggal')->where('tanggal >=', $awal)->where('tanggal <=', $akhir)->get()->getResultArray(),
            'tanggal'
        );

        $n = 0;
        for ($d = new \DateTimeImmutable($awal); $d->format('Y-m-d') <= $akhir; $d = $d->modify('+1 day')) {
            if (in_array(self::HARI[(int) $d->format('N')], $hariKerja, true) && ! in_array($d->format('Y-m-d'), $libur, true)) {
                $n++;
            }
        }
        return $n;
    }
}