<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Models\KuotaCutiModel;

class KuotaCuti extends BaseController
{
    private KuotaCutiModel $model;

    public function __construct()
    {
        $this->model = new KuotaCutiModel();
    }

    /** Admin: daftar kuota (filter tahun, karyawan_id) */
    public function index()
    {
        $tahun      = $this->request->getGet('tahun');
        $karyawanId = $this->request->getGet('karyawan_id');
        $perPage    = min(max((int) ($this->request->getGet('per_page') ?: 10), 1), 100);

        $m = $this->model
            ->select('kuota_cuti.*, karyawan.nama AS karyawan_nama')
            ->join('karyawan', 'karyawan.id = kuota_cuti.karyawan_id');

        if ($tahun)      $m->where('kuota_cuti.tahun', (int) $tahun);
        if ($karyawanId) $m->where('kuota_cuti.karyawan_id', (int) $karyawanId);

        $rows = $m->orderBy('kuota_cuti.tahun', 'DESC')->paginate($perPage);

        return ApiResponse::success(
            array_map([KuotaCutiModel::class, 'format'], $rows),
            'Daftar kuota cuti',
            [
                'page'        => $m->pager->getCurrentPage(),
                'per_page'    => $perPage,
                'total'       => $m->pager->getTotal(),
                'total_pages' => $m->pager->getPageCount(),
            ]
        );
    }

    /** Karyawan: kuota sendiri */
    public function saya()
    {
        $karyawanId = $this->karyawanIdSaatIni();
        if (! $karyawanId) {
            return ApiResponse::error('NO_KARYAWAN', 'Akun ini tidak terhubung ke data karyawan', null, 404);
        }
        $tahun = (int) ($this->request->getGet('tahun') ?: date('Y'));
        $kuota = $this->model->ambilAtauBuat($karyawanId, $tahun);

        return ApiResponse::success(KuotaCutiModel::format($kuota), 'Kuota cuti saya');
    }

    /** Admin: atur total kuota (upsert per karyawan per tahun) */
    public function simpan()
    {
        $in = $this->request->getJSON(true) ?? [];

        $validation = service('validation')->setRules([
            'karyawan_id' => 'required|is_natural_no_zero',
            'tahun'       => 'required|integer|greater_than[2000]',
            'total'       => 'required|numeric|greater_than_equal_to[0]',
        ]);
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Validasi gagal', $validation->getErrors(), 422);
        }

        $ada = db_connect()->table('karyawan')->where('id', $in['karyawan_id'])->countAllResults();
        if (! $ada) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $kuota = $this->model->ambilAtauBuat((int) $in['karyawan_id'], (int) $in['tahun']);
        if ((float) $in['total'] < (float) $kuota['terpakai']) {
            return ApiResponse::error(
                'UNPROCESSABLE',
                'Total kuota tidak boleh kurang dari kuota yang sudah terpakai (' . (float) $kuota['terpakai'] . ')',
                null,
                422
            );
        }

        $this->model->update($kuota['id'], ['total' => $in['total']]);

        return ApiResponse::success(KuotaCutiModel::format($this->model->find($kuota['id'])), 'Kuota cuti disimpan');
    }

    private function karyawanIdSaatIni(): ?int
    {
        $u = JwtService::$user ?? [];
        return ! empty($u['karyawan_id']) ? (int) $u['karyawan_id'] : null;
    }
}