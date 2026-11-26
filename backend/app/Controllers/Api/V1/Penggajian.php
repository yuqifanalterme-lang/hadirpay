<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Services\PayslipFormatter;

class Penggajian extends BaseController
{
    // GET /api/v1/periode-gaji/(:num)/penggajian?page=1&per_page=10&search=rina&departemen_id=1
    public function index($periodeId = null)
    {
        $db = db_connect();

        $periode = $db->table('periode_gaji')->select('id, periode, status')->where('id', (int) $periodeId)->get()->getRowArray();
        if (! $periode) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }

        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) ($this->request->getGet('search') ?? $this->request->getGet('q')));
        $deptId  = (int) ($this->request->getGet('departemen_id') ?? 0);

        $dasar = static function () use ($db, $periodeId, $q, $deptId) {
            $b = $db->table('penggajian g')
                ->join('karyawan k', 'k.id = g.karyawan_id')
                ->join('departemen d', 'd.id = k.departemen_id', 'left')
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
            ->select('g.id, g.gaji_pokok, g.tunjangan, g.total_pendapatan, g.total_potongan, g.gaji_bersih, '
                . 'k.id AS karyawan_id, k.kode AS karyawan_kode, k.nama AS karyawan_nama, d.nama AS departemen_nama')
            ->orderBy('k.nama', 'ASC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        $data = array_map(static fn ($r) => [
            'id'       => (int) $r['id'],
            'karyawan' => [
                'id'         => (int) $r['karyawan_id'],
                'kode'       => $r['karyawan_kode'],
                'nama'       => $r['karyawan_nama'],
                'departemen' => $r['departemen_nama'],
            ],
            'gaji_pokok'       => (float) $r['gaji_pokok'],
            'tunjangan'        => (float) $r['tunjangan'],
            'total_pendapatan' => (float) $r['total_pendapatan'],
            'total_potongan'   => (float) $r['total_potongan'],
            'gaji_bersih'      => (float) $r['gaji_bersih'],
        ], $rows);

        return ApiResponse::success($data, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
            'periode'     => $periode['periode'],
            'status'      => $periode['status'],
        ]);
    }

    // GET /api/v1/penggajian/(:num)   admin_hrd, keuangan, pemilik: semua. karyawan: milik sendiri.
    public function show($id = null)
    {
        $d = PayslipFormatter::detail((int) $id);
        if (! $d) {
            return ApiResponse::error('NOT_FOUND', 'Data penggajian tidak ditemukan', null, 404);
        }

        $user = JwtService::$user ?? [];
        $role = $user['role'] ?? '';
        if (! in_array($role, ['admin_hrd', 'keuangan', 'pemilik'], true)
            && (int) $d['karyawan']['id'] !== (int) ($user['karyawan_id'] ?? 0)) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }

        return ApiResponse::success($d);
    }
}