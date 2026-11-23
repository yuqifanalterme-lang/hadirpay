<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Services\PayrollService;
use Dompdf\Dompdf;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class Laporan extends BaseController
{
    private function hasil(array $data): \CodeIgniter\HTTP\ResponseInterface
    {
        $tabel = $data['tabel'] ?? [];
        $page = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(500, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $total = count($tabel);
        $tabel = array_slice($tabel, ($page - 1) * $perPage, $perPage);

        $cast = static function (&$value) use (&$cast): void {
            if (is_array($value)) {
                foreach ($value as &$child) {
                    $cast($child);
                }
                unset($child);
            } elseif (is_string($value) && preg_match('/^-?\d+\.\d{2}$/', $value)) {
                $value = round((float) $value, 2);
            } elseif (is_float($value)) {
                $value = round($value, 2);
            }
        };
        $cast($data);
        $data['tabel'] = $tabel;

        return ApiResponse::success($data, 'OK', [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    private function periode(): array
    {
        $periode = (string) ($this->request->getGet('periode') ?: date('Y-m'));
        if (! preg_match('/^\d{4}-\d{2}$/', $periode)) {
            $periode = date('Y-m');
        }
        return [$periode . '-01', date('Y-m-t', strtotime($periode . '-01')), $periode];
    }

    private function pang( array &$b, $page, $perPage): array
    {
        $total = $b->countAllResults(false);
        $rows = $b->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();
        return [$rows, ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage)]];
    }

    private function filterDepartemen($b)
    {
        $id = (int) $this->request->getGet('departemen_id');
        if ($id > 0) {
            $b->where('k.departemen_id', $id);
        }
        return $b;
    }

    public function kehadiran()
    {
        [$dari, $sampai, $periode] = $this->periode();
        $db = db_connect();
        $b = $this->filterDepartemen($db->table('absensi a')->join('karyawan k', 'k.id = a.karyawan_id')->where('a.tanggal >=', $dari)->where('a.tanggal <=', $sampai));
        $rows = $b->select('a.status, COUNT(*) AS jumlah', false)->groupBy('a.status')->get()->getResultArray();
        $counts = array_column($rows, 'jumlah', 'status');
        $ringkasan = [
            'total_hadir' => (int) (($counts['hadir'] ?? 0) + ($counts['terlambat'] ?? 0)),
            'rata_rata_hadir_persen' => 0,
            'total_alpha' => (int) ($counts['alpha'] ?? 0),
        ];
        $karyawan = $db->table('karyawan')->where('status', 'aktif');
        $dept = (int) $this->request->getGet('departemen_id');
        if ($dept > 0) $karyawan->where('departemen_id', $dept);
        $total = $karyawan->countAllResults();
        $today = date('Y-m-d');
        $sampaiDipakai = min($sampai, $today);
        $hariDipakai = $sampaiDipakai >= $dari
            ? (new PayrollService())->hariKerja($dari, $sampaiDipakai)
            : [];
        $hadirHinggaHariIni = 0;
        if ($hariDipakai) {
            $q = $db->table('absensi a')
                ->join('karyawan k', 'k.id = a.karyawan_id')
                ->where('a.tanggal >=', $dari)
                ->where('a.tanggal <=', end($hariDipakai))
                ->whereIn('a.status', ['hadir', 'terlambat']);
            if ($dept > 0) {
                $q->where('k.departemen_id', $dept);
            }
            $hadirHinggaHariIni = (int) $q->countAllResults();
        }
        $ringkasan['rata_rata_hadir_persen'] = $total > 0 && $hariDipakai
            ? (int) min(100, round(100 * $hadirHinggaHariIni / ($total * count($hariDipakai))))
            : 0;

        $grafik = [];
        foreach ((new PayrollService())->hariKerja($dari, $sampai) as $tanggal) {
            $n = $db->table('absensi a')->join('karyawan k', 'k.id = a.karyawan_id')->where('a.tanggal', $tanggal);
            $n = $this->filterDepartemen($n)->whereIn('a.status', ['hadir', 'terlambat'])->countAllResults();
            $grafik[] = ['label' => $tanggal, 'nilai' => $n];
        }
        $tabel = $db->table('absensi a')
            ->select('k.id AS karyawan_id, k.kode, k.nama, d.nama AS departemen, SUM(a.status IN (\'hadir\',\'terlambat\')) AS hadir, SUM(a.status = \'terlambat\') AS terlambat, SUM(a.status = \'alpha\') AS alpha', false)
            ->join('karyawan k', 'k.id = a.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('a.tanggal >=', $dari)->where('a.tanggal <=', $sampai)
            ->groupBy('k.id')->orderBy('k.id', 'ASC')->get()->getResultArray();
        $tabel = array_map(static fn ($r) => [
            'karyawan_id' => (int) $r['karyawan_id'],
            'kode' => $r['kode'],
            'nama' => $r['nama'],
            'departemen' => $r['departemen'],
            'hadir' => (int) $r['hadir'],
            'terlambat' => (int) $r['terlambat'],
            'alpha' => (int) $r['alpha'],
        ], $tabel);

        return $this->hasil(['filter' => ['periode' => $periode, 'departemen_id' => $dept ?: null], 'ringkasan' => $ringkasan, 'grafik' => $grafik, 'tabel' => $tabel]);
    }

    public function keterlambatan()
    {
        [$dari, $sampai, $periode] = $this->periode();
        $db = db_connect();
        $b = $db->table('absensi a')->join('karyawan k', 'k.id = a.karyawan_id')->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('a.status', 'terlambat')->where('a.tanggal >=', $dari)->where('a.tanggal <=', $sampai);
        $b = $this->filterDepartemen($b);
        $rows = $b->select('a.tanggal, k.id AS karyawan_id, k.nama, d.nama AS departemen, a.menit_terlambat', false)
            ->orderBy('k.id', 'ASC')->orderBy('a.tanggal', 'DESC')->get()->getResultArray();
        $grafik = [];
        foreach ((new PayrollService())->hariKerja($dari, $sampai) as $tanggal) {
            $grafik[] = ['label' => $tanggal, 'nilai' => array_sum(array_map(fn ($r) => $r['tanggal'] === $tanggal ? (int) $r['menit_terlambat'] : 0, $rows))];
        }
        $totalMenit = array_sum(array_column($rows, 'menit_terlambat'));
        $terbanyak = $rows ? $rows[0]['nama'] : null;
        return $this->hasil([
            'filter' => ['periode' => $periode],
            'ringkasan' => ['total_kejadian' => count($rows), 'total_menit' => (int) $totalMenit, 'karyawan_terbanyak' => $terbanyak],
            'grafik' => $grafik,
            'tabel' => $rows,
        ]);
    }

    public function izinCuti()
    {
        [$dari, $sampai, $periode] = $this->periode();
        $db = db_connect();
        $rows = $db->table('pengajuan_izin p')->select('p.*, k.nama AS karyawan_nama, d.nama AS departemen', false)
            ->join('karyawan k', 'k.id = p.karyawan_id')->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('p.status', 'disetujui')->whereIn('p.jenis', ['izin', 'sakit', 'cuti'])
            ->where('p.tanggal_mulai >=', $dari)->where('p.tanggal_mulai <=', $sampai)
            ->orderBy('p.tanggal_mulai', 'DESC')->get()->getResultArray();
        $counts = ['izin' => 0, 'sakit' => 0, 'cuti' => 0];
        $totalHari = 0.0;
        foreach ($rows as $r) {
            $counts[$r['jenis']]++;
            $totalHari += (float) $r['jumlah_hari'];
        }
        $tabel = array_map(static fn ($r) => [
            'id' => (int) $r['id'],
            'jenis' => $r['jenis'],
            'karyawan' => $r['karyawan_nama'],
            'departemen' => $r['departemen'],
            'tanggal_mulai' => $r['tanggal_mulai'],
            'tanggal_selesai' => $r['tanggal_selesai'],
            'jumlah_hari' => (float) $r['jumlah_hari'],
            'alasan' => $r['alasan'],
        ], $rows);
        return $this->hasil([
            'filter' => ['periode' => $periode],
            'ringkasan' => ['total_izin' => $counts['izin'], 'total_sakit' => $counts['sakit'], 'total_cuti' => $counts['cuti'], 'total_hari' => $totalHari],
            'grafik' => [['label' => 'Izin', 'nilai' => $counts['izin']], ['label' => 'Sakit', 'nilai' => $counts['sakit']], ['label' => 'Cuti', 'nilai' => $counts['cuti']]],
            'tabel' => $tabel,
        ]);
    }

    public function lembur()
    {
        [$dari, $sampai, $periode] = $this->periode();
        $db = db_connect();
        $rows = $db->table('absensi a')->select('a.tanggal, k.id AS karyawan_id, k.nama, d.nama AS departemen, a.lembur_menit', false)
            ->join('karyawan k', 'k.id = a.karyawan_id')->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('a.tanggal >=', $dari)->where('a.tanggal <=', $sampai)->where('a.lembur_menit >', 0)
            ->orderBy('k.id', 'ASC')->orderBy('a.tanggal', 'DESC')->get()->getResultArray();
        $menit = array_sum(array_column($rows, 'lembur_menit'));
        $upah = $db->table('detail_penggajian d')->select('COALESCE(SUM(d.jumlah),0) AS total', false)
            ->join('penggajian g', 'g.id = d.penggajian_id')->join('periode_gaji p', 'p.id = g.periode_gaji_id')
            ->join('komponen_gaji k', 'k.id = d.komponen_id')
            ->where('p.periode', $periode)->where('k.kode', 'LEMBUR')->get()->getRowArray();
        $totalUpah = (float) ($upah['total'] ?? 0);
        return $this->hasil([
            'filter' => ['periode' => $periode],
            'ringkasan' => ['total_jam' => round($menit / 60, 2), 'total_upah' => $totalUpah, 'jumlah_karyawan' => count(array_unique(array_column($rows, 'karyawan_id')))],
            'grafik' => [['label' => $periode, 'nilai' => $menit]],
            'tabel' => $rows,
        ]);
    }

    public function penggajian()
    {
        [$dari, $sampai, $periode] = $this->periode();
        $db = db_connect();
        $rows = $db->table('penggajian g')->select('g.*, k.nama AS karyawan_nama, k.kode, d.nama AS departemen, p.periode', false)
            ->join('periode_gaji p', 'p.id = g.periode_gaji_id')->join('karyawan k', 'k.id = g.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')->where('p.periode', $periode)
            ->orderBy('k.id', 'ASC')->get()->getResultArray();
        $pendapatan = round(array_sum(array_column($rows, 'total_pendapatan')), 2);
        $potongan = round(array_sum(array_column($rows, 'total_potongan')), 2);
        $bersih = round(array_sum(array_column($rows, 'gaji_bersih')), 2);
        $tabel = array_map(static fn ($r) => [
            'penggajian_id' => (int) $r['id'],
            'periode' => $r['periode'],
            'karyawan_id' => (int) $r['karyawan_id'],
            'karyawan' => $r['karyawan_nama'],
            'kode' => $r['kode'],
            'departemen' => $r['departemen'],
            'gaji_pokok' => (float) $r['gaji_pokok'],
            'tunjangan' => (float) $r['tunjangan'],
            'upah_lembur' => (float) $r['upah_lembur'],
            'total_pendapatan' => (float) $r['total_pendapatan'],
            'total_potongan' => (float) $r['total_potongan'],
            'gaji_bersih' => (float) $r['gaji_bersih'],
        ], $rows);
        return $this->hasil([
            'filter' => ['periode' => $periode],
            'ringkasan' => ['total_pendapatan' => (float) $pendapatan, 'total_potongan' => (float) $potongan, 'total_gaji_bersih' => (float) $bersih],
            'grafik' => [['label' => $periode, 'nilai' => (float) $bersih]],
            'tabel' => $tabel,
        ]);
    }

    public function bebanGaji()
    {
        $db = db_connect();
        $dari = (string) ($this->request->getGet('periode_dari') ?: date('Y-m', strtotime('-5 months')));
        $sampai = (string) ($this->request->getGet('periode_sampai') ?: date('Y-m'));
        $dept = (int) $this->request->getGet('departemen_id');
        $rows = $db->table('penggajian g')->select('p.periode, d.nama AS departemen, COUNT(*) AS jumlah_karyawan, SUM(g.total_pendapatan) AS total_pendapatan, SUM(g.total_potongan) AS total_potongan, SUM(g.gaji_bersih) AS total_gaji_bersih', false)
            ->join('periode_gaji p', 'p.id = g.periode_gaji_id')->join('karyawan k', 'k.id = g.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('p.periode >=', $dari)->where('p.periode <=', $sampai)
            ->groupBy('p.periode, d.id')->orderBy('p.periode', 'ASC')->get()->getResultArray();
        if ($dept > 0) {
            $rows = array_values(array_filter($rows, static function ($r) use ($db, $dept) {
                $row = $db->table('departemen')->where('id', $dept)->get()->getRowArray();
                return $row && $r['departemen'] === $row['nama'];
            }));
        }
        $total = round(array_sum(array_column($rows, 'total_gaji_bersih')), 2);
        $periode = [];
        foreach ($rows as $r) {
            $periode[$r['periode']] = ($periode[$r['periode']] ?? 0) + (float) $r['total_gaji_bersih'];
        }
        arsort($periode);
        $highest = $periode ? array_key_first($periode) : null;
        $months = count($periode);
        $tabel = array_map(static fn ($r) => [
            'periode' => $r['periode'],
            'departemen' => $r['departemen'],
            'jumlah_karyawan' => (int) $r['jumlah_karyawan'],
            'total_pendapatan' => (float) $r['total_pendapatan'],
            'total_potongan' => (float) $r['total_potongan'],
            'total_gaji_bersih' => (float) $r['total_gaji_bersih'],
        ], $rows);
        return $this->hasil([
            'filter' => ['periode_dari' => $dari, 'periode_sampai' => $sampai, 'departemen_id' => (int) $this->request->getGet('departemen_id') ?: null],
            'ringkasan' => ['total_beban_gaji' => (float) $total, 'rata_rata_per_bulan' => $months ? round((float) $total / $months, 2) : 0.0, 'periode_tertinggi' => $highest],
            'grafik' => array_map(fn ($ym, $nilai) => ['label' => $ym, 'nilai' => (float) $nilai], array_keys($periode), array_values($periode)),
            'tabel' => $tabel,
        ]);
    }

    public function jurnalPenggajian()
    {
        [$dari, $sampai, $periode] = $this->periode();
        $db = db_connect();
        $rows = $db->table('jurnal j')->select('j.*, p.periode', false)->join('periode_gaji p', 'p.id = j.periode_gaji_id', 'left')
            ->where('j.jenis !=', 'manual')->where('p.periode', $periode)
            ->orderBy('j.tanggal', 'DESC')->get()->getResultArray();
        $debit = round(array_sum(array_column($rows, 'total_debit')), 2);
        $kredit = round(array_sum(array_column($rows, 'total_kredit')), 2);
        $tabel = array_map(static fn ($r) => [
            'id' => (int) $r['id'],
            'nomor_bukti' => $r['nomor_bukti'],
            'tanggal' => $r['tanggal'],
            'keterangan' => $r['keterangan'],
            'jenis' => $r['jenis'],
            'total_debit' => (float) $r['total_debit'],
            'total_kredit' => (float) $r['total_kredit'],
        ], $rows);
        return $this->hasil([
            'filter' => ['periode' => $periode],
            'ringkasan' => ['total_debit' => (float) $debit, 'total_kredit' => (float) $kredit, 'jumlah_jurnal' => count($rows)],
            'grafik' => [['label' => $periode, 'nilai' => (float) $debit]],
            'tabel' => $tabel,
        ]);
    }

    public function export($jenis = null)
    {
        $allowed = ['kehadiran', 'keterlambatan', 'izin-cuti', 'lembur', 'penggajian', 'beban-gaji', 'jurnal-penggajian'];
        if (! in_array((string) $jenis, $allowed, true)) {
            return ApiResponse::error('NOT_FOUND', 'Jenis laporan tidak ditemukan', null, 404);
        }
        $format = strtolower((string) ($this->request->getGet('format') ?: 'xlsx'));
        $methods = [
            'kehadiran' => 'kehadiran', 'keterlambatan' => 'keterlambatan',
            'izin-cuti' => 'izinCuti', 'lembur' => 'lembur', 'penggajian' => 'penggajian',
            'beban-gaji' => 'bebanGaji', 'jurnal-penggajian' => 'jurnalPenggajian',
        ];
        $_GET['page'] = '1';
        $_GET['per_page'] = '500';
        $response = $this->{$methods[$jenis]}();
        if ($response->getStatusCode() >= 400) {
            return $response;
        }
        $body = $response->getJSON();
        $json = json_decode($body, true);
        $data = $json['data'] ?? [];
        $table = $data['tabel'] ?? [];

        if ($format === 'xlsx') {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Laporan');
            if ($table) {
                $headers = array_keys($table[0]);
                $sheet->fromArray($headers, null, 'A1');
                $sheet->fromArray(array_map(fn ($r) => array_values($r), $table), null, 'A2');
                $lastColumn = $sheet->getHighestColumn();
                $sheet->getStyle('A1:' . $lastColumn . '1')->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '1E3A8A']],
                ]);
                $sheet->freezePane('A2');
                $sheet->setAutoFilter('A1:' . $lastColumn . $sheet->getHighestRow());
                foreach (range('A', $lastColumn) as $col) {
                    $sheet->getColumnDimension($col)->setAutoSize(true);
                }
            }
            $tmp = tempnam(sys_get_temp_dir(), 'report');
            (new Xlsx($spreadsheet))->save($tmp);
            $content = file_get_contents($tmp);
            unlink($tmp);
            $filename = 'laporan-' . $jenis . '-' . date('Y-m-d') . '.xlsx';
            return $this->response->setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')->setBody($content);
        }
        if ($format === 'pdf') {
            $judul = [
                'kehadiran' => 'Laporan Kehadiran',
                'keterlambatan' => 'Laporan Keterlambatan',
                'izin-cuti' => 'Laporan Izin dan Cuti',
                'lembur' => 'Laporan Lembur',
                'penggajian' => 'Laporan Penggajian Bulanan',
                'beban-gaji' => 'Laporan Beban Gaji',
                'jurnal-penggajian' => 'Laporan Jurnal Penggajian',
            ][$jenis];
            $label = static function (string $key): string {
                $labels = [
                    'karyawan_id' => 'ID Karyawan',
                    'karyawan_kode' => 'Kode Karyawan',
                    'penggajian_id' => 'ID Penggajian',
                    'nomor_bukti' => 'Nomor Bukti',
                    'total_gaji_bersih' => 'Total Gaji Bersih',
                    'total_pendapatan' => 'Total Pendapatan',
                    'total_potongan' => 'Total Potongan',
                    'total_beban_gaji' => 'Total Beban Gaji',
                ];
                return $labels[$key] ?? ucwords(str_replace('_', ' ', $key));
            };
            $html = '<!doctype html><html><head><meta charset="utf-8"><style>
                @page { size: A4 landscape; margin: 28px 30px 38px; }
                body { font-family: DejaVu Sans, sans-serif; color: #172554; font-size: 9px; }
                h1 { margin: 0; color: #1e3a8a; font-size: 20px; }
                .brand { color: #64748b; font-size: 9px; letter-spacing: 1.5px; font-weight: bold; }
                .subtitle { color: #64748b; margin: 5px 0 16px; }
                .top { border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; }
                .meta { color: #475569; font-size: 8px; margin-top: 8px; }
                .summary { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 -6px 16px; }
                .summary td { width: 25%; background: #eff6ff; border: 1px solid #dbeafe; padding: 9px; vertical-align: top; }
                .summary-label { color: #64748b; font-size: 8px; }
                .summary-value { color: #172554; font-size: 12px; font-weight: bold; margin-top: 4px; }
                table.data { width: 100%; border-collapse: collapse; }
                .data thead { display: table-header-group; }
                .data th { background: #1e3a8a; color: #fff; text-align: left; padding: 7px 6px; font-size: 8px; }
                .data td { border-bottom: 1px solid #e2e8f0; padding: 6px; color: #1e293b; vertical-align: top; }
                .data tr:nth-child(even) td { background: #f8fafc; }
                .empty { color: #64748b; padding: 16px 0; }
                .footer { position: fixed; bottom: -24px; left: 0; right: 0; color: #64748b; font-size: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px; }
                .page:after { content: counter(page); }
            </style></head><body>';
            $html .= '<div class="top"><div class="brand">HADIRPAY</div><h1>' . esc($judul) . '</h1>';
            $html .= '<div class="subtitle">Dokumen laporan resmi</div><div class="meta">';
            $filterParts = [];
            foreach (($data['filter'] ?? []) as $key => $value) {
                if ($value !== null && $value !== '') {
                    $filterParts[] = esc($label((string) $key)) . ': ' . esc((string) $value);
                }
            }
            $html .= implode(' &nbsp; | &nbsp; ', $filterParts);
            $html .= ' &nbsp; | &nbsp; Dicetak: ' . esc(date('d/m/Y H:i')) . '</div></div>';

            $summary = array_filter(($data['ringkasan'] ?? []), static fn ($value) => $value !== null && $value !== '');
            if ($summary) {
                $html .= '<table class="summary"><tr>';
                foreach ($summary as $key => $value) {
                    $display = is_numeric($value) && (str_contains($key, 'gaji') || str_contains($key, 'upah') || str_contains($key, 'beban') || str_contains($key, 'debit') || str_contains($key, 'kredit'))
                        ? 'Rp ' . number_format((float) $value, 2, ',', '.')
                        : (is_numeric($value) ? number_format((float) $value, 0, ',', '.') : (string) $value);
                    $html .= '<td><div class="summary-label">' . esc($label((string) $key)) . '</div><div class="summary-value">' . esc($display) . '</div></td>';
                }
                $html .= '</tr></table>';
            }
            if ($table) {
                $html .= '<table class="data"><thead><tr>';
                foreach (array_keys($table[0]) as $h) $html .= '<th>' . esc($label((string) $h)) . '</th>';
                $html .= '</tr></thead><tbody>';
                foreach ($table as $row) {
                    $html .= '<tr>';
                    foreach ($row as $key => $v) {
                        $display = is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : (string) $v;
                        if (is_numeric($v) && (str_contains((string) $key, 'gaji') || str_contains((string) $key, 'upah') || str_contains((string) $key, 'pendapatan') || str_contains((string) $key, 'potongan') || str_contains((string) $key, 'debit') || str_contains((string) $key, 'kredit'))) {
                            $display = 'Rp ' . number_format((float) $v, 2, ',', '.');
                        }
                        $html .= '<td>' . esc($display) . '</td>';
                    }
                    $html .= '</tr>';
                }
                $html .= '</tbody></table>';
            } else {
                $html .= '<div class="empty">Tidak ada data untuk filter yang dipilih.</div>';
            }
            $html .= '<div class="footer">HADIRPAY &nbsp; • &nbsp; Dokumen dibuat otomatis &nbsp; <span style="float:right">Halaman <span class="page"></span></span></div></body></html>';
            $dompdf = new Dompdf();
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'landscape');
            $dompdf->render();
            $filename = 'laporan-' . $jenis . '-' . date('Y-m-d') . '.pdf';
            return $this->response->setContentType('application/pdf')
                ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')->setBody($dompdf->output());
        }
        return ApiResponse::error('VALIDATION_ERROR', 'Format ekspor tidak didukung', ['format' => 'Gunakan pdf atau xlsx'], 422);
    }
}
