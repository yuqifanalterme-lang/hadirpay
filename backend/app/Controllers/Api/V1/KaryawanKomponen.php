<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\KaryawanKomponenModel;

class KaryawanKomponen extends BaseController
{
    private KaryawanKomponenModel $model;

    public function __construct()
    {
        $this->model = new KaryawanKomponenModel();
    }

    // GET /api/v1/karyawan/(:num)/komponen
    public function index($karyawanId = null)
    {
        if (! $this->karyawanAda($karyawanId)) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $rows = $this->model->denganKomponen()
            ->where('karyawan_komponen.karyawan_id', (int) $karyawanId)
            ->orderBy('komponen_gaji.tipe', 'ASC')
            ->orderBy('komponen_gaji.nama', 'ASC')
            ->findAll();

        return ApiResponse::success(array_map([KaryawanKomponenModel::class, 'format'], $rows));
    }

    // POST /api/v1/karyawan/(:num)/komponen   body: {komponen_id, nilai?}
    public function create($karyawanId = null)
    {
        if (! $this->karyawanAda($karyawanId)) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules([
            'komponen_id' => 'required|is_natural_no_zero|is_not_unique[komponen_gaji.id]',
            'nilai'       => 'permit_empty|numeric|greater_than_equal_to[0]',
        ], [
            'komponen_id' => [
                'required'      => 'Komponen wajib dipilih',
                'is_not_unique' => 'Komponen tidak ditemukan',
            ],
            'nilai' => ['numeric' => 'Nilai harus berupa angka', 'greater_than_equal_to' => 'Nilai tidak boleh negatif'],
        ]);
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $komp = db_connect()->table('komponen_gaji')->where('id', (int) $input['komponen_id'])->get()->getRowArray();
        if (! (int) $komp['aktif']) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['komponen_id' => 'Komponen ini sedang nonaktif'], 422);
        }

        $nilai = (isset($input['nilai']) && $input['nilai'] !== '') ? $input['nilai'] : $komp['nilai'];
        if ($nilai === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'nilai' => 'Nilai wajib diisi karena komponen ini tidak punya nilai default',
            ], 422);
        }
        if ($komp['metode'] === 'persen' && (float) $nilai > 100) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['nilai' => 'Persen tidak boleh lebih dari 100'], 422);
        }
        if ($komp['kode'] === 'BPJS' && (float) $nilai !== (float) $komp['nilai']) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['nilai' => 'Nilai BPJS mengikuti persentase pada komponen master'], 422);
        }

        $sudah = $this->model
            ->where('karyawan_id', (int) $karyawanId)
            ->where('komponen_id', (int) $komp['id'])
            ->countAllResults();
        if ($sudah > 0) {
            return ApiResponse::error('CONFLICT', 'Komponen ini sudah dipasang ke karyawan tersebut', null, 409);
        }

        $id = $this->model->insert([
            'karyawan_id' => (int) $karyawanId,
            'komponen_id' => (int) $komp['id'],
            'nilai'       => $nilai,
        ], true);

        $row = $this->model->denganKomponen()->where('karyawan_komponen.id', $id)->first();

        return ApiResponse::success(KaryawanKomponenModel::format($row), 'Komponen dipasang ke karyawan', null, 201);
    }

    // PUT /api/v1/karyawan/(:num)/komponen/(:num)   body: {nilai}
    public function update($karyawanId = null, $komponenId = null)
    {
        $row = $this->cari($karyawanId, $komponenId);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Komponen karyawan tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules([
            'nilai' => 'required|numeric|greater_than_equal_to[0]',
        ], [
            'nilai' => [
                'required'              => 'Nilai wajib diisi',
                'numeric'               => 'Nilai harus berupa angka',
                'greater_than_equal_to' => 'Nilai tidak boleh negatif',
            ],
        ]);
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        if ($row['metode'] === 'persen' && (float) $input['nilai'] > 100) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['nilai' => 'Persen tidak boleh lebih dari 100'], 422);
        }
        if ($row['kode'] === 'BPJS' && (float) $input['nilai'] !== (float) $row['nilai_default']) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['nilai' => 'Nilai BPJS mengikuti persentase pada komponen master'], 422);
        }

        $this->model->update($row['id'], ['nilai' => $input['nilai']]);

        $baru = $this->model->denganKomponen()->where('karyawan_komponen.id', $row['id'])->first();

        return ApiResponse::success(KaryawanKomponenModel::format($baru), 'Nilai komponen diperbarui');
    }

    // DELETE /api/v1/karyawan/(:num)/komponen/(:num)
    public function delete($karyawanId = null, $komponenId = null)
    {
        $row = $this->cari($karyawanId, $komponenId);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Komponen karyawan tidak ditemukan', null, 404);
        }
        if ($row['kode'] === 'BPJS') {
            return ApiResponse::error('CONFLICT', 'Komponen BPJS otomatis terpasang pada karyawan', null, 409);
        }

        $this->model->delete($row['id']);
        return ApiResponse::success(null, 'Komponen dilepas dari karyawan');
    }

    // ---------- helper ----------

    private function karyawanAda($id): bool
    {
        return db_connect()->table('karyawan')->where('id', (int) $id)->countAllResults() > 0;
    }

    private function cari($karyawanId, $komponenId): ?array
    {
        return $this->model->denganKomponen()
            ->where('karyawan_komponen.karyawan_id', (int) $karyawanId)
            ->where('karyawan_komponen.komponen_id', (int) $komponenId)
            ->first();
    }
}