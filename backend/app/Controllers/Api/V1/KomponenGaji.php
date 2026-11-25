<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\KomponenGajiModel;

class KomponenGaji extends BaseController
{
    private KomponenGajiModel $model;

    public function __construct()
    {
        $this->model = new KomponenGajiModel();
    }

    // GET /api/v1/komponen-gaji?page=1&per_page=10&q=bpjs&tipe=potongan&aktif=1
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) ($this->request->getGet('search') ?? $this->request->getGet('q')));
        $tipe    = (string) $this->request->getGet('tipe');
        $aktif   = $this->request->getGet('aktif');

        if ($q !== '') {
            $this->model->groupStart()->like('nama', $q)->orLike('kode', $q)->groupEnd();
        }
        if (in_array($tipe, KomponenGajiModel::TIPE, true)) {
            $this->model->where('tipe', $tipe);
        }
        if ($aktif === '0' || $aktif === '1') {
            $this->model->where('aktif', (int) $aktif);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('tipe', 'ASC')->orderBy('nama', 'ASC')->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success(array_map([KomponenGajiModel::class, 'format'], $rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // GET /api/v1/komponen-gaji/(:num)
    public function show($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Komponen gaji tidak ditemukan', null, 404);
        }
        return ApiResponse::success(KomponenGajiModel::format($row));
    }

    // POST /api/v1/komponen-gaji
    public function create()
    {
        $input = $this->bersihkan($this->request->getJSON(true) ?? []);

        $validation = service('validation');
        $validation->setRules($this->rules(null), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }
        if ($err = $this->cekNilai($input)) {
            return $err;
        }

        $aktif = $this->aktifDari($input, 1);
        if ($aktif === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Nilai aktif harus true atau false'], 422);
        }

        $id = $this->model->insert([
            'kode'       => $input['kode'],
            'nama'       => $input['nama'],
            'tipe'       => $input['tipe'],
            'metode'     => $input['metode'],
            'nilai'      => $input['nilai'] ?? null,
            'keterangan' => $input['keterangan'] ?? null,
            'sistem'     => 0,
            'aktif'      => $aktif,
        ], true);

        return ApiResponse::success(KomponenGajiModel::format($this->model->find($id)), 'Komponen gaji dibuat', null, 201);
    }

    // PUT /api/v1/komponen-gaji/(:num)
    public function update($id = null)
    {
        $lama = $this->model->find($id);
        if (! $lama) {
            return ApiResponse::error('NOT_FOUND', 'Komponen gaji tidak ditemukan', null, 404);
        }

        $patch = $this->request->getJSON(true) ?? [];
        $patch = array_intersect_key($patch, array_flip([
            'kode', 'nama', 'tipe', 'metode', 'nilai', 'keterangan', 'aktif',
        ]));
        $input = array_merge($lama, $this->bersihkan($patch));

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }
        if ($err = $this->cekNilai($input)) {
            return $err;
        }

        $aktif = $this->aktifDari($input, (int) $lama['aktif']);
        if ($aktif === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Nilai aktif harus true atau false'], 422);
        }

        $berubahInti = strcasecmp($input['kode'], $lama['kode']) !== 0
            || $input['tipe'] !== $lama['tipe']
            || $input['metode'] !== $lama['metode'];

        if ($berubahInti) {
            if ((int) $lama['sistem'] === 1) {
                return ApiResponse::error('SYSTEM_COMPONENT', 'Komponen sistem: kode, tipe, dan metode tidak boleh diubah', null, 422);
            }
            if ($this->jumlahPemakai((int) $id) > 0) {
                return ApiResponse::error('IN_USE', 'Komponen sudah dipakai karyawan, kode, tipe, dan metode tidak boleh diubah', null, 409);
            }
        }

        $db = db_connect();
        $db->transBegin();
        try {
            $updated = $this->model->update($id, [
                'kode'       => (int) $lama['sistem'] === 1 ? $lama['kode'] : $input['kode'],
                'nama'       => $input['nama'],
                'tipe'       => $input['tipe'],
                'metode'     => $input['metode'],
                'nilai'      => $input['nilai'] ?? null,
                'keterangan' => $input['keterangan'] ?? null,
                'aktif'      => $aktif,
            ]);
            if ($updated === false) {
                throw new \RuntimeException('Pembaruan komponen gaji ditolak oleh model.');
            }

            if ($db->transStatus() === false) {
                throw new \RuntimeException('Sinkronisasi komponen gaji tidak berhasil disimpan.');
            }
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal memperbarui komponen gaji: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal memperbarui komponen gaji', null, 500);
        }

        return ApiResponse::success(KomponenGajiModel::format($this->model->find($id)), 'Komponen gaji diperbarui');
    }

    // DELETE /api/v1/komponen-gaji/(:num)
    public function delete($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Komponen gaji tidak ditemukan', null, 404);
        }
        if ((int) $row['sistem'] === 1) {
            return ApiResponse::error('SYSTEM_COMPONENT', 'Komponen sistem tidak boleh dihapus', null, 422);
        }

        $pemakai = $this->jumlahPemakai((int) $id);
        if ($pemakai > 0) {
            return ApiResponse::error(
                'IN_USE',
                "Komponen masih dipakai {$pemakai} karyawan. Nonaktifkan saja (aktif: false).",
                null,
                409
            );
        }

        $this->model->delete($id);
        return ApiResponse::success(null, 'Komponen gaji dihapus');
    }

    // PATCH /api/v1/komponen-gaji/(:num)/status   body: {"aktif": true|false}
    public function status($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Komponen gaji tidak ditemukan', null, 404);
        }

        $in = $this->request->getJSON(true) ?? [];
        if (! array_key_exists('aktif', $in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Aktif wajib diisi (true atau false)'], 422);
        }
        $v = filter_var($in['aktif'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($v === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Nilai aktif harus true atau false'], 422);
        }

        $this->model->update($id, ['aktif' => (int) $v]);

        return ApiResponse::success(KomponenGajiModel::format($this->model->find($id)), 'Status komponen diperbarui');
    }

    // ---------- helper ----------

    private function jumlahPemakai(int $komponenId): int
    {
        return db_connect()->table('karyawan_komponen')->where('komponen_id', $komponenId)->countAllResults();
    }

    private function bersihkan(array $in): array
    {
        if (isset($in['kode']))       $in['kode'] = strtoupper(trim((string) $in['kode']));
        if (isset($in['nama']))       $in['nama'] = trim((string) $in['nama']);
        if (array_key_exists('nilai', $in) && $in['nilai'] === '') $in['nilai'] = null;
        if (isset($in['keterangan'])) $in['keterangan'] = trim((string) $in['keterangan']);
        return $in;
    }

    /** null = nilai tidak valid */
    private function aktifDari(array $in, int $default): ?int
    {
        if (! array_key_exists('aktif', $in)) {
            return $default;
        }
        $v = filter_var($in['aktif'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $v === null ? null : (int) $v;
    }

    private function cekNilai(array $in)
    {
        if (($in['kode'] ?? '') === 'BPJS'
            && (($in['tipe'] ?? '') !== 'potongan' || ($in['metode'] ?? '') !== 'persen' || (float) ($in['nilai'] ?? 0) !== 3.0)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'nilai' => 'BPJS harus tetap berupa potongan sebesar 3 persen',
            ], 422);
        }
        if (($in['metode'] ?? '') === 'persen' && isset($in['nilai']) && (float) $in['nilai'] > 100) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['nilai' => 'Persen tidak boleh lebih dari 100'], 422);
        }
        return null;
    }

    private function rules(?int $id): array
    {
        $ex = $id === null ? '' : ',id,' . $id;

        return [
            'kode'       => 'required|alpha_dash|max_length[30]|is_unique[komponen_gaji.kode' . $ex . ']',
            'nama'       => 'required|min_length[2]|max_length[100]',
            'tipe'       => 'required|in_list[pendapatan,potongan]',
            'metode'     => 'required|in_list[nominal_tetap,persen,per_hari,per_menit]',
            'nilai'      => 'permit_empty|numeric|greater_than_equal_to[0]',
            'keterangan' => 'permit_empty|max_length[255]',
        ];
    }

    private function messages(): array
    {
        return [
            'kode' => [
                'required'   => 'Kode wajib diisi',
                'alpha_dash' => 'Kode hanya boleh huruf, angka, strip, dan underscore',
                'is_unique'  => 'Kode komponen sudah dipakai',
            ],
            'nama'   => ['required' => 'Nama wajib diisi', 'min_length' => 'Nama minimal 2 karakter'],
            'tipe'   => ['required' => 'Tipe wajib dipilih', 'in_list' => 'Tipe harus pendapatan atau potongan'],
            'metode' => [
                'required' => 'Metode wajib dipilih',
                'in_list'  => 'Metode harus nominal_tetap, persen, per_hari, atau per_menit',
            ],
            'nilai' => ['numeric' => 'Nilai harus berupa angka', 'greater_than_equal_to' => 'Nilai tidak boleh negatif'],
        ];
    }
}