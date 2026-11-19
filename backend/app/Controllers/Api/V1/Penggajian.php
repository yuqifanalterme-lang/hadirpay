<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Services\PayrollService;

class Penggajian extends BaseController
{
    // GET /api/v1/periode-gaji/(:num)/penggajian?page=1&per_page=10&q=rina&departemen_id=1
    public function index($periodeId = null)
    {
        $db = db_connect();

        $periode = $db->table('periode_gaji')->select('id, periode, status')->where('id', (int) $periodeId)->get()->getRowArray();
        if (! $periode) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }

        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) $this->request->getGet('q'));
        $deptId  = (int) ($this->request->getGet('departemen_id') ?? 0);

        $dasar = static function () use ($db, $periodeId, $q, $deptId) {
            $b = $db->table('penggajian g')
                ->join('karyawan k', 'k.id = g.karyawan_id')
                ->join('departemen d', 'd.id = k.departemen_id', 'left')
                ->join('jabatan j', 'j.id = k.jabatan_id', 'left')
                ->join('slip_gaji s', 's.penggajian_id = g.id', 'left')
                ->where('g.periode_gaji_id', (int) $periodeId);

            if ($q !== '') {
                $b->groupStart()->like('k.nama', $q)->orLike('k.kode', $q)->groupEnd();
            }
            if ($deptId > 0) {
                $b->where('k.departemen_id', $deptId);
            }
            return $b;
        };

        $total = $dasar()->countAllResults();

        $rows = $dasar()
            ->select('g.id, g.periode_gaji_id, g.karyawan_id, g.gaji_pokok, g.tunjangan, g.upah_lembur, g.total_pendapatan, '
                . 'g.total_potongan, g.gaji_bersih, g.tarif_harian, k.kode AS karyawan_kode, k.nama AS karyawan_nama, '
                . 'd.nama AS departemen_nama, j.nama AS jabatan_nama, s.nomor_slip')
            ->orderBy('k.nama', 'ASC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        return ApiResponse::success(array_map([PayrollService::class, 'castUang'], $rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
            'periode'     => $periode['periode'],
            'status'      => $periode['status'],
        ]);
    }

    // GET /api/v1/penggajian/(:num)
    public function show($id = null)
    {
        $db = db_connect();

        $g = $db->table('penggajian g')
            ->select('g.*, k.kode AS karyawan_kode, k.nama AS karyawan_nama, k.npwp, k.no_bpjs, '
                . 'd.nama AS departemen_nama, j.nama AS jabatan_nama, p.periode, p.status AS periode_status, p.tanggal_mulai, p.tanggal_selesai')
            ->join('karyawan k', 'k.id = g.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->join('jabatan j', 'j.id = k.jabatan_id', 'left')
            ->join('periode_gaji p', 'p.id = g.periode_gaji_id')
            ->where('g.id', (int) $id)
            ->get()->getRowArray();

        if (! $g) {
            return ApiResponse::error('NOT_FOUND', 'Data penggajian tidak ditemukan', null, 404);
        }

        $detail = $db->table('detail_penggajian')->where('penggajian_id', (int) $id)->orderBy('urutan', 'ASC')->get()->getResultArray();
        $detail = array_map(static function ($d) {
            $d['jumlah'] = (float) $d['jumlah'];
            return $d;
        }, $detail);

        $g['rekap'] = $g['rekap_json'] ? json_decode($g['rekap_json'], true) : null;
        unset($g['rekap_json']);
        $g = PayrollService::castUang($g);

        $g['pendapatan'] = array_values(array_filter($detail, static fn ($d) => $d['tipe'] === 'pendapatan'));
        $g['potongan']   = array_values(array_filter($detail, static fn ($d) => $d['tipe'] === 'potongan'));

        return ApiResponse::success($g);
    }
}