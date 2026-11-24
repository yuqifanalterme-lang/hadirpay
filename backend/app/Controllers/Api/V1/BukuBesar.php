<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Services\AccountingService;

class BukuBesar extends BaseController
{
    // GET /api/v1/buku-besar?akun_id=2&tanggal_dari=2026-11-01&tanggal_sampai=2026-11-30
    public function index()
    {
        $db     = db_connect();
        $akunId = (int) $this->request->getGet('akun_id');
        if ($akunId <= 0) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['akun_id' => 'akun_id wajib diisi'], 422);
        }

        $akun = $db->table('akun')->where('id', $akunId)->get()->getRowArray();
        if (! $akun) {
            return ApiResponse::error('NOT_FOUND', 'Akun tidak ditemukan', null, 404);
        }

        $dari        = $this->tgl('tanggal_dari');
        $sampai      = $this->tgl('tanggal_sampai');
        $normalDebit = $akun['saldo_normal'] === 'debit';
        $hitung      = static fn (int $d, int $k): int => $normalDebit ? $d - $k : $k - $d;

        $saldo = 0;
        if ($dari) {
            $aw = $db->table('detail_jurnal dj')
                ->select('COALESCE(SUM(dj.debit),0) AS d, COALESCE(SUM(dj.kredit),0) AS k', false)
                ->join('jurnal j', 'j.id = dj.jurnal_id')
                ->where('dj.akun_id', $akunId)
                ->where('j.status', 'aktif')
                ->where('j.tanggal <', $dari)
                ->get()->getRowArray();
            $saldo = $hitung(AccountingService::sen($aw['d']), AccountingService::sen($aw['k']));
        }
        $saldoAwal = $saldo;

        $b = $db->table('detail_jurnal dj')
            ->select('j.id AS jurnal_id, j.tanggal, j.nomor_bukti, j.keterangan, dj.debit, dj.kredit')
            ->join('jurnal j', 'j.id = dj.jurnal_id')
            ->where('dj.akun_id', $akunId)
            ->where('j.status', 'aktif');
        if ($dari) {
            $b->where('j.tanggal >=', $dari);
        }
        if ($sampai) {
            $b->where('j.tanggal <=', $sampai);
        }
        $rows = $b->orderBy('j.tanggal', 'ASC')->orderBy('j.id', 'ASC')->orderBy('dj.id', 'ASC')->get()->getResultArray();

        $mutasi = [];
        $td     = 0;
        $tk     = 0;
        foreach ($rows as $r) {
            $d = AccountingService::sen($r['debit']);
            $k = AccountingService::sen($r['kredit']);
            $saldo += $hitung($d, $k);
            $td    += $d;
            $tk    += $k;
            $mutasi[] = [
                'tanggal'     => $r['tanggal'],
                'nomor_bukti' => $r['nomor_bukti'],
                'jurnal_id'   => (int) $r['jurnal_id'],
                'keterangan'  => $r['keterangan'],
                'debit'       => $d / 100,
                'kredit'      => $k / 100,
                'saldo'       => $saldo / 100,
            ];
        }

        return ApiResponse::success([
            'akun' => [
                'id'           => (int) $akun['id'],
                'kode'         => $akun['kode'],
                'nama'         => $akun['nama'],
                'saldo_normal' => $akun['saldo_normal'],
            ],
            'saldo_awal'   => $saldoAwal / 100,
            'mutasi'       => $mutasi,
            'total_debit'  => $td / 100,
            'total_kredit' => $tk / 100,
            'saldo_akhir'  => $saldo / 100,
        ]);
    }

    private function tgl(string $key): ?string
    {
        $v = (string) $this->request->getGet($key);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    }
}