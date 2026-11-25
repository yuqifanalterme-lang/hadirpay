<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Libraries\Tanggal;
use App\Services\AttendanceService;
use App\Services\PayrollService;

/**
 * Dashboard (kontrak bagian 3). Semua angka dihitung di sini, FE hanya menampilkan.
 * Konvensi: "hadir" sudah termasuk "terlambat".
 */
class Dashboard extends BaseController
{
    private const JUDUL = [
        'izin' => 'Izin',
        'sakit' => 'Sakit',
        'cuti' => 'Cuti tahunan',
        'koreksi_absensi' => 'Koreksi absensi',
    ];
    private const LABEL_ROLE = ['admin_hrd' => 'HRD', 'keuangan' => 'Keuangan', 'pemilik' => 'Pemilik', 'karyawan' => 'Karyawan'];

    private function user(): array
    {
        return JwtService::$user ?? [];
    }

    private function izin(array $roles)
    {
        return in_array($this->user()['role'] ?? '', $roles, true)
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

    private function persen(float $bagian, float $total): int
    {
        return $total > 0 ? (int) min(100, round(100 * $bagian / $total)) : 0;
    }

    private function angka(float $v): string
    {
        return rtrim(rtrim(number_format($v, 1, '.', ''), '0'), '.') ?: '0';
    }

    private function jadwal(): array
    {
        try {
            $j = (new AttendanceService())->jadwal();
        } catch (\Throwable $e) {
            $j = [];
        }
        return [
            'masuk' => substr((string) ($j['jam_masuk'] ?? '08:00'), 0, 5),
            'pulang' => substr((string) ($j['jam_pulang'] ?? '17:00'), 0, 5),
            'toleransi' => (int) ($j['toleransi_menit'] ?? 0),
        ];
    }

    /** @return array<string, array{hadir:int, tepat:int}> kunci = tanggal; hanya karyawan aktif */
    private function hadirPerTanggal(string $dari, string $sampai): array
    {
        $rows = db_connect()->table('absensi a')
            ->select("a.tanggal, SUM(a.status IN ('hadir','terlambat')) AS hadir, SUM(a.status = 'hadir') AS tepat", false)
            ->join('karyawan k', 'k.id = a.karyawan_id')
            ->where('k.status', 'aktif')
            ->where('a.tanggal >=', $dari)->where('a.tanggal <=', $sampai)
            ->groupBy('a.tanggal')
            ->get()->getResultArray();

        $out = [];
        foreach ($rows as $r) {
            $out[$r['tanggal']] = ['hadir' => (int) $r['hadir'], 'tepat' => (int) $r['tepat']];
        }
        return $out;
    }

    private function durasiLabel(array $r): string
    {
        if ($r['jenis'] === 'koreksi_absensi') {
            return '1 hari';
        }
        return $this->angka((float) $r['jumlah_hari']) . ' hari';
    }

    private function saldoAkun(string $kode, string $normal, ?string $dari = null, ?string $sampai = null): float
    {
        $db = db_connect();
        $b = $db->table('detail_jurnal dj')
            ->select('COALESCE(SUM(dj.debit), 0) AS d, COALESCE(SUM(dj.kredit), 0) AS k', false)
            ->join('akun a', 'a.id = dj.akun_id')
            ->join('jurnal j', 'j.id = dj.jurnal_id')
            ->where('a.kode', $kode)
            ->where('j.status', 'aktif');
        if ($dari !== null) {
            $b->where('j.tanggal >=', $dari);
        }
        if ($sampai !== null) {
            $b->where('j.tanggal <=', $sampai);
        }
        $r = $b->get()->getRowArray();
        $d = (float) ($r['d'] ?? 0);
        $k = (float) ($r['k'] ?? 0);
        return $normal === 'kredit' ? $k - $d : $d - $k;
    }

    /** Total gaji bersih (atau pendapatan) periode berjalan; bila belum dihitung, estimasi dari gaji pokok + tunjangan tetap */
    private function totalGajiPeriode(string $ym, string $kolom): float
    {
        $db = db_connect();
        $p = $db->table('periode_gaji')->where('periode', $ym)->get()->getRowArray();
        $t = 0.0;
        if ($p) {
            $r = $db->table('penggajian')->select('COALESCE(SUM(' . $kolom . '), 0) AS s', false)->where('periode_gaji_id', (int) $p['id'])->get()->getRowArray();
            $t = (float) ($r['s'] ?? 0);
        }
        if ($t <= 0) {
            $r = $db->table('karyawan')->select('COALESCE(SUM(gaji_pokok + tunjangan_tetap), 0) AS s', false)->where('status', 'aktif')->get()->getRowArray();
            $t = (float) ($r['s'] ?? 0);
        }
        return $t;
    }

    // ================= GET /dashboard/admin =================

    public function admin()
    {
        if ($e = $this->izin(['admin_hrd'])) {
            return $e;
        }
        $tanggal = (string) ($this->request->getGet('tanggal') ?: date('Y-m-d'));
        if (!$this->tglValid($tanggal)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal' => 'Tanggal harus berformat YYYY-MM-DD'], 422);
        }

        $db = db_connect();
        $payroll = new PayrollService();
        $jadwal = $this->jadwal();
        $total = $db->table('karyawan')->where('status', 'aktif')->countAllResults();

        // hitung per status pada tanggal itu
        $c = ['hadir' => 0, 'terlambat' => 0, 'izin' => 0, 'sakit' => 0, 'cuti' => 0, 'alpha' => 0];
        $rows = $db->table('absensi a')->select('a.status AS st, COUNT(*) AS n', false)
            ->join('karyawan k', 'k.id = a.karyawan_id')
            ->where('k.status', 'aktif')->where('a.tanggal', $tanggal)
            ->groupBy('a.status')->get()->getResultArray();
        foreach ($rows as $r) {
            if (isset($c[$r['st']])) {
                $c[$r['st']] = (int) $r['n'];
            }
        }
        $hadir = $c['hadir'] + $c['terlambat'];
        $persenHadir = $this->persen($hadir, $total);

        $ym = substr($tanggal, 0, 7);
        $periode = $db->table('periode_gaji')->where('periode', $ym)->get()->getRowArray();
        $menunggu = $db->table('pengajuan_izin')->where('status', 'menunggu')->countAllResults();

        // minggu berjalan (Senin sampai Jumat)
        $dow = (int) date('N', strtotime($tanggal));
        $senin = date('Y-m-d', strtotime('-' . ($dow - 1) . ' days', strtotime($tanggal)));
        $jumat = date('Y-m-d', strtotime($senin . ' +4 days'));
        $minggu = $this->hadirPerTanggal($senin, $jumat);
        $hari = [];
        for ($i = 0; $i < 5; $i++) {
            $d = date('Y-m-d', strtotime($senin . ' +' . $i . ' days'));
            $hari[] = [
                'tanggal' => $d,
                'persen_hadir' => $d > $tanggal ? null : $this->persen($minggu[$d]['hadir'] ?? 0, $total),
                'status' => $d < $tanggal ? 'selesai' : ($d === $tanggal ? 'hari_ini' : 'akan_datang'),
            ];
        }

        // rata-rata minggu lalu (hanya hari kerja)
        $senin2 = date('Y-m-d', strtotime($senin . ' -7 days'));
        $jumat2 = date('Y-m-d', strtotime($senin2 . ' +4 days'));
        $lalu = $this->hadirPerTanggal($senin2, $jumat2);
        $hk2 = $payroll->hariKerja($senin2, $jumat2);
        $rata = 0;
        if ($hk2) {
            $jumlah = 0;
            foreach ($hk2 as $d) {
                $jumlah += $this->persen($lalu[$d]['hadir'] ?? 0, $total);
            }
            $rata = (int) round($jumlah / count($hk2));
        }

        // tren 7 hari kerja terakhir
        $tren = [];
        $rentang = array_slice($payroll->hariKerja(date('Y-m-d', strtotime($tanggal . ' -20 days')), $tanggal), -7);
        if ($rentang) {
            $map = $this->hadirPerTanggal($rentang[0], end($rentang));
            foreach ($rentang as $d) {
                $tren[] = ['tanggal' => $d, 'hadir' => $map[$d]['hadir'] ?? 0, 'tepat_waktu' => $map[$d]['tepat'] ?? 0];
            }
        }

        // pengajuan menunggu (5 terlama)
        $pm = $db->table('pengajuan_izin p')
            ->select('p.*, k.nama AS karyawan_nama')
            ->join('karyawan k', 'k.id = p.karyawan_id')
            ->where('p.status', 'menunggu')
            ->orderBy('p.created_at', 'ASC')->orderBy('p.id', 'ASC')
            ->limit(5)->get()->getResultArray();
        $listPengajuan = array_map(fn($r) => [
            'id' => (int) $r['id'],
            'jenis' => $r['jenis'],
            'karyawan' => ['id' => (int) $r['karyawan_id'], 'nama' => $r['karyawan_nama'], 'inisial' => self::inisial($r['karyawan_nama'])],
            'judul' => self::JUDUL[$r['jenis']] ?? $r['jenis'],
            'durasi_label' => $this->durasiLabel($r),
            'tanggal_mulai' => $r['tanggal_mulai'],
            'tanggal_selesai' => $r['tanggal_selesai'],
        ], $pm);

        // absensi terbaru (5 check-in terakhir pada tanggal itu)
        $at = $db->table('absensi a')
            ->select('a.jam_masuk, a.jam_pulang, a.status, k.id AS kid, k.nama, d.nama AS dept')
            ->join('karyawan k', 'k.id = a.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('a.tanggal', $tanggal)->where('a.jam_masuk IS NOT NULL', null, false)
            ->orderBy('a.jam_masuk', 'DESC')->limit(5)->get()->getResultArray();
        $listAbsensi = array_map(fn($r) => [
            'karyawan' => ['id' => (int) $r['kid'], 'nama' => $r['nama'], 'inisial' => self::inisial($r['nama'])],
            'departemen' => $r['dept'],
            'jam_masuk' => $this->jam($r['jam_masuk']),
            'jam_pulang' => $this->jam($r['jam_pulang']),
            'status' => $r['status'],
        ], $at);

        return ApiResponse::success([
            'tanggal' => $tanggal,
            'sapaan_rekap' => [
                'persen_terisi' => $persenHadir,
                'pengajuan_menunggu' => $menunggu,
                'periode_ditutup' => $periode['tanggal_tutup'] ?? ($ym . '-25'),
            ],
            'statistik' => [
                'total_karyawan' => $total,
                'hadir_hari_ini' => $hadir,
                'persen_hadir' => $persenHadir,
                'terlambat' => $c['terlambat'],
                'batas_terlambat' => date('H:i', strtotime($tanggal . ' ' . $jadwal['masuk'] . ' +' . $jadwal['toleransi'] . ' minutes')),
                'tidak_hadir' => [
                    'total' => $c['izin'] + $c['sakit'] + $c['cuti'] + $c['alpha'],
                    'izin' => $c['izin'] + $c['sakit'],
                    'cuti' => $c['cuti'],
                    'alpha' => $c['alpha'],
                ],
                'total_gaji_bulan_berjalan' => round($this->totalGajiPeriode($ym, 'gaji_bersih'), 2),
                'periode_gaji' => $ym,
            ],
            'kehadiran_minggu_ini' => ['rata_rata_minggu_lalu' => $rata, 'hari' => $hari],
            'tren_kehadiran' => $tren,
            'pengajuan_menunggu' => $listPengajuan,
            'absensi_terbaru' => $listAbsensi,
        ]);
    }

    // ================= GET /dashboard/karyawan =================

    public function karyawan()
    {
        if ($e = $this->izin(['karyawan', 'keuangan'])) {
            return $e;
        }
        $u = $this->user();
        $kid = (int) ($u['karyawan_id'] ?? 0);
        $uid = (int) ($u['id'] ?? 0);
        if ($kid <= 0) {
            return ApiResponse::error('FORBIDDEN', 'Akun ini tidak terhubung dengan data karyawan', null, 403);
        }

        $db = db_connect();
        $hariIni = date('Y-m-d');
        $jadwal = $this->jadwal();

        $lok = $db->table('lokasi_absensi')->where('aktif', 1)->orderBy('id', 'ASC')->limit(1)->get()->getRowArray();

        $a = $db->table('absensi')->where('karyawan_id', $kid)->where('tanggal', $hariIni)->get()->getRowArray();

        // minggu berjalan
        $dow = (int) date('N');
        $senin = date('Y-m-d', strtotime('-' . ($dow - 1) . ' days'));
        $jumat = date('Y-m-d', strtotime($senin . ' +4 days'));
        $rows = $db->table('absensi')->select('tanggal, status')
            ->where('karyawan_id', $kid)->where('tanggal >=', $senin)->where('tanggal <=', $jumat)
            ->get()->getResultArray();
        $status = [];
        foreach ($rows as $r) {
            $status[$r['tanggal']] = $r['status'];
        }
        $hari = [];
        $tercatat = $telat = 0;
        for ($i = 0; $i < 5; $i++) {
            $d = date('Y-m-d', strtotime($senin . ' +' . $i . ' days'));
            $st = $status[$d] ?? null;
            $hari[] = ['tanggal' => $d, 'status' => $st];
            if ($st === 'hadir' || $st === 'terlambat') {
                $tercatat++;
            }
            if ($st === 'terlambat') {
                $telat++;
            }
        }

        // slip terakhir
        $s = $db->table('slip_gaji sg')
            ->select('sg.id, sg.tanggal_terbit, pp.periode, pg.gaji_bersih, pg.total_pendapatan, pg.total_potongan')
            ->join('penggajian pg', 'pg.id = sg.penggajian_id')
            ->join('periode_gaji pp', 'pp.id = pg.periode_gaji_id')
            ->where('pg.karyawan_id', $kid)
            ->orderBy('sg.tanggal_terbit', 'DESC')->orderBy('sg.id', 'DESC')
            ->limit(1)->get()->getRowArray();

        // pengajuan terakhir
        $p = $db->table('pengajuan_izin')->where('karyawan_id', $kid)->where('status !=', 'dibatalkan')
            ->orderBy('created_at', 'DESC')->orderBy('id', 'DESC')->limit(1)->get()->getRowArray();
        $oleh = null;
        if ($p && !empty($p['diproses_oleh'])) {
            $pu = $db->table('users')->select('nama, role')->where('id', (int) $p['diproses_oleh'])->get()->getRowArray();
            if ($pu) {
                $oleh = $pu['nama'] . ' (' . (self::LABEL_ROLE[$pu['role']] ?? $pu['role']) . ')';
            }
        }

        $notif = $db->table('notifikasi')->where('user_id', $uid)->where('dibaca_pada IS NULL', null, false)->countAllResults();

        return ApiResponse::success([
            'tanggal' => $hariIni,
            'server_time' => Tanggal::waktuIso(date('Y-m-d H:i:s')),
            'jam_kerja' => ['masuk' => $jadwal['masuk'], 'pulang' => $jadwal['pulang']],
            'lokasi_kantor' => $lok ? ['nama' => $lok['nama'], 'alamat' => $lok['alamat']] : null,
            'absensi_hari_ini' => [
                'sudah_masuk' => !empty($a['jam_masuk']),
                'sudah_pulang' => !empty($a['jam_pulang']),
                'jam_masuk' => $this->jam($a['jam_masuk'] ?? null),
                'jam_pulang' => $this->jam($a['jam_pulang'] ?? null),
                'status' => $a['status'] ?? null,
            ],
            'kehadiran_minggu_ini' => ['tercatat' => $tercatat, 'total_hari' => 5, 'jumlah_terlambat' => $telat, 'hari' => $hari],
            'slip_terakhir' => $s ? [
                'id' => (int) $s['id'],
                'periode' => $s['periode'],
                'tanggal_terbit' => $s['tanggal_terbit'],
                'gaji_bersih' => (float) $s['gaji_bersih'],
                'total_pendapatan' => (float) $s['total_pendapatan'],
                'total_potongan' => (float) $s['total_potongan'],
            ] : null,
            'pengajuan_terakhir' => $p ? [
                'id' => (int) $p['id'],
                'jenis' => $p['jenis'],
                'judul' => self::JUDUL[$p['jenis']] ?? $p['jenis'],
                'tanggal_mulai' => $p['tanggal_mulai'],
                'status' => $p['status'],
                'tanggal_diajukan' => substr((string) $p['created_at'], 0, 10),
                'disetujui_oleh' => $oleh,
            ] : null,
            'jumlah_notifikasi' => $notif,
        ]);
    }

    // ================= GET /dashboard/keuangan =================

    public function keuangan()
    {
        if ($e = $this->izin(['keuangan'])) {
            return $e;
        }
        $db = db_connect();

        $menunggu = $db->table('periode_gaji pp')
            ->select('pp.id, pp.periode, COALESCE(SUM(pg.gaji_bersih), 0) AS total, COUNT(pg.id) AS jml', false)
            ->join('penggajian pg', 'pg.periode_gaji_id = pp.id', 'left')
            ->where('pp.status', 'menunggu_validasi')
            ->groupBy('pp.id, pp.periode')
            ->orderBy('pp.periode', 'ASC')
            ->get()->getResultArray();

        $j = $db->table('periode_gaji')->select('periode, tanggal_bayar, status')
            ->where('status', 'disetujui')->orderBy('periode', 'ASC')->limit(1)->get()->getRowArray();
        if (!$j) {
            $j = $db->table('periode_gaji')->select('periode, tanggal_bayar, status')
                ->where('status', 'dibayar')->orderBy('tanggal_bayar', 'DESC')->orderBy('periode', 'DESC')->limit(1)->get()->getRowArray();
        }

        $awal = date('Y-m-01');
        $akhir = date('Y-m-t');

        return ApiResponse::success([
            'periode_menunggu_validasi' => array_map(static fn($r) => [
                'id' => (int) $r['id'],
                'periode' => $r['periode'],
                'total_gaji_bersih' => (float) $r['total'],
                'jumlah_karyawan' => (int) $r['jml'],
            ], $menunggu),
            'jadwal_pembayaran' => $j ? ['periode' => $j['periode'], 'tanggal_bayar' => $j['tanggal_bayar'], 'status' => $j['status']] : null,
            'saldo_utang_gaji' => round($this->saldoAkun('2-1100', 'kredit'), 2),
            'total_beban_gaji_bulan_berjalan' => round($this->saldoAkun('5-1100', 'debit', $awal, $akhir), 2),
        ]);
    }

    // ================= GET /dashboard/pemilik =================

    public function pemilik()
    {
        if ($e = $this->izin(['pemilik'])) {
            return $e;
        }
        $db = db_connect();
        $payroll = new PayrollService();
        $awal = date('Y-m-01');
        $hariIni = date('Y-m-d');
        $ym = date('Y-m');

        $tren = $db->table('periode_gaji pp')
            ->select('pp.periode, COALESCE(SUM(pg.total_pendapatan), 0) AS total', false)
            ->join('penggajian pg', 'pg.periode_gaji_id = pp.id', 'left')
            ->where('pp.periode <=', $ym)
            ->groupBy('pp.id, pp.periode')
            ->orderBy('pp.periode', 'DESC')->limit(6)
            ->get()->getResultArray();
        $tren = array_reverse($tren);

        // kehadiran per departemen: bulan berjalan sampai hari ini
        $n = count($payroll->hariKerja($awal, $hariIni));
        $dept = $db->table('karyawan k')
            ->select('d.id, d.nama, COUNT(k.id) AS jml', false)
            ->join('departemen d', 'd.id = k.departemen_id')
            ->where('k.status', 'aktif')
            ->groupBy('d.id, d.nama')->orderBy('d.nama', 'ASC')
            ->get()->getResultArray();
        $hadirRows = $db->table('absensi a')
            ->select("k.departemen_id, SUM(a.status IN ('hadir','terlambat')) AS h", false)
            ->join('karyawan k', 'k.id = a.karyawan_id')
            ->where('k.status', 'aktif')->where('a.tanggal >=', $awal)->where('a.tanggal <=', $hariIni)
            ->groupBy('k.departemen_id')
            ->get()->getResultArray();
        $hadir = [];
        foreach ($hadirRows as $r) {
            $hadir[(int) $r['departemen_id']] = (int) $r['h'];
        }
        $perDept = array_map(fn($d) => [
            'departemen' => $d['nama'],
            'persen_hadir' => $this->persen($hadir[(int) $d['id']] ?? 0, (int) $d['jml'] * $n),
        ], $dept);

        $top = $db->table('absensi a')
            ->select('k.id, k.nama, d.nama AS dept, COUNT(*) AS jml, COALESCE(SUM(a.menit_terlambat), 0) AS menit', false)
            ->join('karyawan k', 'k.id = a.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('a.status', 'terlambat')->where('a.tanggal >=', $awal)->where('a.tanggal <=', $hariIni)
            ->groupBy('k.id, k.nama, d.nama')
            ->orderBy('jml', 'DESC')->orderBy('menit', 'DESC')->limit(5)
            ->get()->getResultArray();

        return ApiResponse::success([
            'total_biaya_gaji_bulan_berjalan' => round($this->totalGajiPeriode($ym, 'total_pendapatan'), 2),
            'tren_beban_gaji' => array_map(static fn($r) => ['periode' => $r['periode'], 'total' => (float) $r['total']], $tren),
            'kehadiran_per_departemen' => $perDept,
            'top_keterlambatan' => array_map(static fn($r) => [
                'karyawan_id' => (int) $r['id'],
                'nama' => $r['nama'],
                'departemen' => $r['dept'],
                'jumlah_terlambat' => (int) $r['jml'],
                'total_menit' => (int) $r['menit'],
            ], $top),
        ]);
    }
}