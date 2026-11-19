<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Services\PayrollService;

class SlipGaji extends BaseController
{
    private const ROLE_LIHAT_SEMUA = ['admin_hrd', 'keuangan', 'pemilik'];

    // GET /api/v1/slip-gaji/saya?page=1&per_page=12
    public function saya()
    {
        $kid = $this->karyawanId();
        if (! $kid) {
            return ApiResponse::error('NO_KARYAWAN', 'Akun ini tidak terhubung ke data karyawan', null, 404);
        }

        $db      = db_connect();
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 12)));

        $dasar = static function () use ($db, $kid) {
            return $db->table('slip_gaji s')
                ->join('penggajian g', 'g.id = s.penggajian_id')
                ->join('periode_gaji p', 'p.id = g.periode_gaji_id')
                ->where('g.karyawan_id', $kid);
        };

        $total = $dasar()->countAllResults();
        $rows  = $dasar()
            ->select('s.id, s.nomor_slip, s.tanggal_terbit, p.periode, p.tanggal_bayar, g.gaji_bersih')
            ->orderBy('p.periode', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        $rows = array_map(static function ($r) {
            $r['gaji_bersih'] = (float) $r['gaji_bersih'];
            return $r;
        }, $rows);

        return ApiResponse::success($rows, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // GET /api/v1/slip-gaji/(:num)   pemilik slip, atau admin_hrd / keuangan / pemilik
    public function show($id = null)
    {
        $db = db_connect();

        $s = $db->table('slip_gaji s')
            ->select('s.id, s.nomor_slip, s.tanggal_terbit, g.id AS penggajian_id, g.karyawan_id, g.gaji_pokok, g.tunjangan, '
                . 'g.upah_lembur, g.total_pendapatan, g.total_potongan, g.gaji_bersih, g.tarif_harian, g.rekap_json, '
                . 'p.periode, p.tanggal_mulai, p.tanggal_selesai, p.tanggal_bayar, '
                . 'k.kode AS karyawan_kode, k.nama AS karyawan_nama, k.npwp, k.no_bpjs, '
                . 'd.nama AS departemen_nama, j.nama AS jabatan_nama')
            ->join('penggajian g', 'g.id = s.penggajian_id')
            ->join('periode_gaji p', 'p.id = g.periode_gaji_id')
            ->join('karyawan k', 'k.id = g.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->join('jabatan j', 'j.id = k.jabatan_id', 'left')
            ->where('s.id', (int) $id)
            ->get()->getRowArray();

        if (! $s) {
            return ApiResponse::error('NOT_FOUND', 'Slip gaji tidak ditemukan', null, 404);
        }

        $role = (JwtService::$user ?? [])['role'] ?? '';
        if (! in_array($role, self::ROLE_LIHAT_SEMUA, true) && (int) $s['karyawan_id'] !== $this->karyawanId()) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }

        $detail = $db->table('detail_penggajian')->where('penggajian_id', (int) $s['penggajian_id'])->orderBy('urutan', 'ASC')->get()->getResultArray();
        $detail = array_map(static function ($d) {
            $d['jumlah'] = (float) $d['jumlah'];
            return $d;
        }, $detail);

        $s['rekap'] = $s['rekap_json'] ? json_decode($s['rekap_json'], true) : null;
        unset($s['rekap_json']);
        $s = PayrollService::castUang($s);

        $s['pendapatan'] = array_values(array_filter($detail, static fn ($d) => $d['tipe'] === 'pendapatan'));
        $s['potongan']   = array_values(array_filter($detail, static fn ($d) => $d['tipe'] === 'potongan'));

        return ApiResponse::success($s);
    }

    private function karyawanId(): ?int
    {
        $id = (JwtService::$user ?? [])['karyawan_id'] ?? null;
        return $id !== null ? (int) $id : null;
    }
}