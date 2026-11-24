<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Services\AccountingService;

class NeracaSaldo extends BaseController
{
    // GET /api/v1/neraca-saldo?tanggal_sampai=2026-11-30
    public function index()
    {
        $v      = (string) $this->request->getGet('tanggal_sampai');
        $sampai = preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : date('Y-m-d');

        $db = db_connect();
        $b = $db->table('akun a')
            ->select('a.id, a.kode, a.nama, COALESCE(SUM(dj.debit),0) AS d, COALESCE(SUM(dj.kredit),0) AS k', false)
            ->join('detail_jurnal dj', 'dj.akun_id = a.id')
            ->join('jurnal j', 'j.id = dj.jurnal_id')
            ->where('j.status', 'aktif')
            ->where('j.tanggal <=', $sampai);
        if ($db->fieldExists('reversal_of', 'jurnal')) {
            $b->where('j.reversal_of IS NULL', null, false);
        }
        $rows = $b->groupBy('a.id, a.kode, a.nama')
            ->orderBy('a.kode', 'ASC')
            ->get()->getResultArray();

        $akun = [];
        $td   = 0;
        $tk   = 0;
        foreach ($rows as $r) {
            $d   = AccountingService::sen($r['d']);
            $k   = AccountingService::sen($r['k']);
            $net = $d - $k;
            $deb = $net >= 0 ? $net : 0;
            $kre = $net < 0 ? -$net : 0;
            $td += $deb;
            $tk += $kre;
            $akun[] = [
                'akun_id' => (int) $r['id'],
                'kode'    => $r['kode'],
                'nama'    => $r['nama'],
                'debit'   => $deb / 100,
                'kredit'  => $kre / 100,
            ];
        }

        return ApiResponse::success([
            'per_tanggal'  => $sampai,
            'akun'         => $akun,
            'total_debit'  => $td / 100,
            'total_kredit' => $tk / 100,
            'seimbang'     => $td === $tk,
        ]);
    }
}