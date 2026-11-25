<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Services\PayrollService;

/**
 * Absensi sisi admin (kontrak bagian 5.2) dan rekap absensi untuk payroll.
 * Konvensi: "hadir" sudah termasuk "terlambat" (terlambat adalah bagian dari hadir).
 */
class AbsensiAdmin extends BaseController
{
    private const LABEL_PENGAJUAN = [
        'izin' => 'izin', 'sakit' => 'sakit', 'cuti' => 'cuti',
        'koreksi_absensi' => 'koreksi absensi',
    ];

    private function izin(array $roles)
    {
        $role = (JwtService::$user ?? [])['role'] ?? '';
        return in_array($role, $roles, true)
            ? null
            : ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
    }

    private static function inisial(string $nama): string
    {
        $kata = preg_split('/\s+/', trim($nama));
        return strtoupper(mb_substr($kata[0], 0, 1) . (isset($kata[1]) ? mb_substr($kata[1], 0, 1) : ''));
    }

    private function jam($v): ?string
    {
        return $v === null ? null : substr((string) $v, 0, 5);
    }

    private function tglValid(string $t): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $t)
            && checkdate((int) substr($t, 5, 2), (int) substr($t, 8, 2), (int) substr($t, 0, 4));
    }

    private function tanggalParam(): ?string
    {
        $t = (string) $this->request->getGet('tanggal');
        if ($t === '') {
            return date('Y-m-d');
        }
        return $this->tglValid($t) ? $t : null;
    }

    private function statusParam(): ?string
    {
        $s = (string) $this->request->getGet('status');
        return in_array($s, ['hadir', 'terlambat', 'izin', 'sakit', 'cuti', 'alpha', 'dinas_luar', 'belum_absen'], true) ? $s : null;
    }

    private function dasarHarian(string $tanggal, int $dept, string $q, ?string $status)
    {
        $db = db_connect();
        $b  = $db->table('karyawan k')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->join('absensi a', 'a.karyawan_id = k.id AND a.tanggal = ' . $db->escape($tanggal), 'left', false)
            ->where('k.status', 'aktif');

        if ($dept > 0) {
            $b->where('k.departemen_id', $dept);
        }
        if ($q !== '') {
            $b->groupStart()->like('k.nama', $q)->orLike('k.kode', $q)->groupEnd();
        }
        if ($status === 'belum_absen') {
            $b->where('a.id IS NULL', null, false);
        } elseif ($status !== null) {
            $b->where('a.status', $status);
        }
        return $b;
    }

    private function barisHarian(array $r, string $tanggal): array
    {
        $lat = $r['lokasi_masuk_lat'] ?? null;
        $lng = $r['lokasi_masuk_lng'] ?? null;
        $dr  = $r['dalam_radius'] ?? null;

        return [
            'id'              => $r['id'] === null ? null : (int) $r['id'],
            'karyawan'        => [
                'id'      => (int) $r['karyawan_pk'],
                'kode'    => $r['kode'],
                'nama'    => $r['nama'],
                'inisial' => self::inisial($r['nama']),
            ],
            'departemen'      => $r['departemen_nama'],
            'tanggal'         => $tanggal,
            'jam_masuk'       => $this->jam($r['jam_masuk'] ?? null),
            'jam_pulang'      => $this->jam($r['jam_pulang'] ?? null),
            'durasi_menit'    => ($r['durasi_menit'] ?? null) === null ? null : (int) $r['durasi_menit'],
            'status'          => $r['status'] ?? null,
            'menit_terlambat' => (int) ($r['menit_terlambat'] ?? 0),
            'lokasi'          => $lat === null ? null : [
                'latitude'     => (float) $lat,
                'longitude'    => (float) $lng,
                'dalam_radius' => $dr === null ? null : (bool) $dr,
            ],
        ];
    }

    private const SELECT_HARIAN = 'k.id AS karyawan_pk, k.kode, k.nama, d.nama AS departemen_nama, a.*';

    // GET /api/v1/absensi?tanggal=&departemen_id=&status=&search=&page=&per_page=   (admin_hrd, pemilik)
    public function index()
    {
        if ($e = $this->izin(['admin_hrd', 'pemilik'])) {
            return $e;
        }
        $tanggal = $this->tanggalParam();
        if ($tanggal === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal' => 'Tanggal harus berformat YYYY-MM-DD'], 422);
        }

        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $dept    = (int) $this->request->getGet('departemen_id');
        $q       = trim((string) $this->request->getGet('search'));
        $status  = $this->statusParam();

        $total = $this->dasarHarian($tanggal, $dept, $q, $status)->countAllResults();
        $rows  = $this->dasarHarian($tanggal, $dept, $q, $status)
            ->select(self::SELECT_HARIAN)
            ->orderBy('k.nama', 'ASC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        $c   = ['hadir' => 0, 'terlambat' => 0, 'izin' => 0, 'sakit' => 0, 'cuti' => 0, 'alpha' => 0];
        $hit = $this->dasarHarian($tanggal, $dept, $q, null)
            ->select('a.status AS st, COUNT(*) AS n', false)
            ->where('a.id IS NOT NULL', null, false)
            ->groupBy('a.status')
            ->get()->getResultArray();
        foreach ($hit as $h) {
            if (isset($c[$h['st']])) {
                $c[$h['st']] = (int) $h['n'];
            }
        }
        $c['hadir'] += $c['terlambat'];

        return ApiResponse::success(
            array_map(fn ($r) => $this->barisHarian($r, $tanggal), $rows),
            'OK',
            ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage)],
            200,
            ['ringkasan' => $c]
        );
    }

    // GET /api/v1/absensi/export?tanggal=&departemen_id=&status=&search=   (admin_hrd)
    public function export()
    {
        if ($e = $this->izin(['admin_hrd'])) {
            return $e;
        }
        $tanggal = $this->tanggalParam();
        if ($tanggal === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal' => 'Tanggal harus berformat YYYY-MM-DD'], 422);
        }

        $rows = $this->dasarHarian($tanggal, (int) $this->request->getGet('departemen_id'), trim((string) $this->request->getGet('search')), $this->statusParam())
            ->select(self::SELECT_HARIAN)
            ->orderBy('k.nama', 'ASC')
            ->get()->getResultArray();

        $h = fopen('php://temp', 'r+');
        fputcsv($h, ['Kode', 'Nama', 'Departemen', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Durasi (menit)', 'Status', 'Menit Terlambat'], ',', '"', '\\');
        foreach ($rows as $r) {
            $b = $this->barisHarian($r, $tanggal);
            fputcsv($h, [
                $b['karyawan']['kode'], $b['karyawan']['nama'], $b['departemen'], $b['tanggal'],
                $b['jam_masuk'], $b['jam_pulang'], $b['durasi_menit'], $b['status'] ?? 'belum_absen', $b['menit_terlambat'],
            ], ',', '"', '\\');
        }
        rewind($h);
        $csv = stream_get_contents($h);
        fclose($h);

        return $this->response
            ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->setHeader('Content-Disposition', 'attachment; filename="absensi-' . $tanggal . '.csv"')
            ->setBody("\xEF\xBB\xBF" . $csv);
    }

    // GET /api/v1/absensi/rekap?periode=2026-11&departemen_id=&search=&page=&per_page=   (admin_hrd, keuangan, pemilik)
    public function rekap()
    {
        $periode = (string) $this->request->getGet('periode');
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periode)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['periode' => 'Periode wajib berformat YYYY-MM'], 422);
        }

        $mulai = $periode . '-01';
        $akhir = date('Y-m-t', strtotime($mulai));

        $hasil = $this->bangunRekap(
            $mulai,
            $akhir,
            (int) $this->request->getGet('departemen_id'),
            trim((string) $this->request->getGet('search')),
            max(1, (int) ($this->request->getGet('page') ?? 1)),
            min(500, max(1, (int) ($this->request->getGet('per_page') ?? 10)))
        );

        return ApiResponse::success(
            ['periode' => $periode, 'ringkasan' => $hasil['ringkasan'], 'karyawan' => $hasil['karyawan']],
            'OK',
            $hasil['meta']
        );
    }

    // GET /api/v1/periode-gaji/(:num)/rekap-absensi   (admin_hrd, keuangan, pemilik)
    public function rekapPeriode($id = null)
    {
        $db = db_connect();
        $p  = $db->table('periode_gaji')->where('id', (int) $id)->get()->getRowArray();
        if (! $p) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }

        $mulai = $p['tanggal_mulai'];
        $akhir = $p['tanggal_selesai'];

        $hasil = $this->bangunRekap(
            $mulai,
            $akhir,
            (int) $this->request->getGet('departemen_id'),
            trim((string) $this->request->getGet('search')),
            max(1, (int) ($this->request->getGet('page') ?? 1)),
            min(500, max(1, (int) ($this->request->getGet('per_page') ?? 100)))
        );

        $peringatan = [];
        $menunggu   = $db->table('pengajuan_izin')
            ->select('karyawan_id, jenis, COUNT(*) AS n', false)
            ->where('status', 'menunggu')
            ->where('tanggal_mulai <=', $akhir)->where('tanggal_selesai >=', $mulai)
            ->groupBy('karyawan_id, jenis')
            ->get()->getResultArray();
        foreach ($menunggu as $m) {
            $peringatan[] = [
                'karyawan_id' => (int) $m['karyawan_id'],
                'jenis'       => 'pengajuan_menunggu',
                'pesan'       => 'Ada ' . (int) $m['n'] . ' pengajuan ' . (self::LABEL_PENGAJUAN[$m['jenis']] ?? $m['jenis']) . ' belum diproses',
            ];
        }

        return ApiResponse::success(
            [
                'periode'    => $p['periode'],
                'ringkasan'  => $hasil['ringkasan'],
                'karyawan'   => $hasil['karyawan'],
                'peringatan' => $peringatan,
            ],
            'OK',
            $hasil['meta']
        );
    }

    // ---------- inti rekap ----------

    private function bangunRekap(string $mulai, string $akhir, int $dept, string $q, int $page, int $perPage): array
    {
        $db     = db_connect();
        $filter = static function () use ($db, $dept, $q) {
            $b = $db->table('karyawan k')
                ->join('departemen d', 'd.id = k.departemen_id', 'left')
                ->where('k.status', 'aktif');
            if ($dept > 0) {
                $b->where('k.departemen_id', $dept);
            }
            if ($q !== '') {
                $b->groupStart()->like('k.nama', $q)->orLike('k.kode', $q)->groupEnd();
            }
            return $b;
        };

        $total = $filter()->countAllResults();
        $semua = array_map('intval', array_column($filter()->select('k.id')->get()->getResultArray(), 'id'));
        $rows  = $filter()->select('k.id, k.kode, k.nama, d.nama AS departemen_nama')
            ->orderBy('k.nama', 'ASC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        $payroll   = new PayrollService();
        $hariKerja = count($payroll->hariKerja($mulai, $akhir));
        $agg       = $this->agregat($semua, $mulai, $akhir);
        $nol       = ['hadir' => 0, 'terlambat' => 0, 'izin' => 0, 'sakit' => 0, 'cuti' => 0, 'alpha' => 0, 'telat' => 0];

        $list = [];
        foreach ($rows as $r) {
            $a      = $agg[(int) $r['id']] ?? $nol;
            $list[] = [
                'karyawan_id'           => (int) $r['id'],
                'kode'                  => $r['kode'],
                'nama'                  => $r['nama'],
                'departemen'            => $r['departemen_nama'],
                'hari_kerja'            => $hariKerja,
                'hadir'                 => $a['hadir'],
                'terlambat'             => $a['terlambat'],
                'izin'                  => $a['izin'],
                'sakit'                 => $a['sakit'],
                'cuti'                  => $a['cuti'],
                'alpha'                 => $a['alpha'],
                'total_menit_terlambat' => $a['telat'],
            ];
        }

        $tHadir = $tTerlambat = $tAlpha = 0;
        foreach ($agg as $a) {
            $tHadir     += $a['hadir'];
            $tTerlambat += $a['terlambat'];
            $tAlpha     += $a['alpha'];
        }

        // penyebut persen: hari kerja sampai hari ini bila periode masih berjalan
        $sampai   = min($akhir, date('Y-m-d'));
        $berjalan = $sampai >= $mulai ? count($payroll->hariKerja($mulai, $sampai)) : 0;
        $persen   = ($total > 0 && $berjalan > 0) ? (int) min(100, round(100 * $tHadir / ($total * $berjalan))) : 0;

        return [
            'ringkasan' => [
                'total_karyawan'         => $total,
                'rata_rata_hadir_persen' => $persen,
                'total_terlambat'        => $tTerlambat,
                'total_alpha'            => $tAlpha,
            ],
            'karyawan'  => $list,
            'meta'      => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage)],
        ];
    }

    /** @return array<int, array<string,int>> */
    private function agregat(array $ids, string $mulai, string $akhir): array
    {
        if (! $ids) {
            return [];
        }

        $db = db_connect();
        $payroll = new PayrollService();
        $hariKerja = $payroll->hariKerja($mulai, $akhir);
        $today = date('Y-m-d');
        $out = [];

        $absensiRows = $db->table('absensi')
            ->select('karyawan_id, tanggal, status, menit_terlambat')
            ->whereIn('karyawan_id', $ids)
            ->where('tanggal >=', $mulai)->where('tanggal <=', $akhir)
            ->get()->getResultArray();
        $absensi = [];
        foreach ($absensiRows as $r) {
            $absensi[(int) $r['karyawan_id']][$r['tanggal']] = $r;
        }

        $izinRows = $db->table('pengajuan_izin')
            ->select('karyawan_id, jenis, tanggal_mulai, tanggal_selesai')
            ->whereIn('karyawan_id', $ids)
            ->where('status', 'disetujui')
            ->whereIn('jenis', ['izin', 'sakit', 'cuti'])
            ->where('tanggal_mulai <=', $akhir)->where('tanggal_selesai >=', $mulai)
            ->get()->getResultArray();
        $izin = [];
        foreach ($izinRows as $r) {
            $izin[(int) $r['karyawan_id']][] = $r;
        }

        foreach ($ids as $kid) {
            $a = ['hadir' => 0, 'terlambat' => 0, 'izin' => 0, 'sakit' => 0, 'cuti' => 0, 'alpha' => 0, 'telat' => 0];
            foreach ($hariKerja as $tanggal) {
                $status = null;
                if (isset($absensi[$kid][$tanggal])) {
                    $status = $absensi[$kid][$tanggal]['status'];
                } else {
                    foreach ($izin[$kid] ?? [] as $z) {
                        if ($tanggal >= $z['tanggal_mulai'] && $tanggal <= $z['tanggal_selesai']) {
                            $status = $z['jenis'];
                            break;
                        }
                    }
                    if ($status === null && $tanggal < $today) {
                        $status = 'alpha';
                    }
                }
                if (isset($a[$status])) {
                    $a[$status]++;
                } elseif ($status === 'dinas_luar') {
                    $a['hadir']++;
                }
                if ($status === 'hadir' || $status === 'terlambat' || $status === 'dinas_luar') {
                    if ($status === 'terlambat') {
                        $a['hadir']++;
                    }
                }
            }

            foreach ($absensi[$kid] ?? [] as $tanggal => $r) {
                if (! in_array($tanggal, $hariKerja, true)) {
                    continue;
                }
                $a['telat'] += (int) $r['menit_terlambat'];
            }
            $out[$kid] = $a;
        }
        return $out;
    }
}