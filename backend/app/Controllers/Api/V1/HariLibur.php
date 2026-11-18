<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\HariLiburModel;

class HariLibur extends BaseController
{
    private HariLiburModel $model;

    public function __construct()
    {
        $this->model = new HariLiburModel();
    }

    // GET /api/v1/hari-libur?tahun=2026&bulan=12&q=natal&page=1&per_page=50
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(366, max(1, (int) ($this->request->getGet('per_page') ?? 50)));
        $q       = trim((string) $this->request->getGet('q'));
        $tahun   = (int) ($this->request->getGet('tahun') ?? 0);
        $bulan   = (int) ($this->request->getGet('bulan') ?? 0);

        if ($q !== '') {
            $this->model->like('nama', $q);
        }
        if ($tahun > 0) {
            $this->model->where('YEAR(tanggal)', $tahun, false);
        }
        if ($bulan >= 1 && $bulan <= 12) {
            $this->model->where('MONTH(tanggal)', $bulan, false);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('tanggal', 'ASC')->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success($rows, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    public function show($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Hari libur tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    public function create()
    {
        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules(null), $this->messages());

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $id = $this->model->insert([
            'tanggal' => $input['tanggal'],
            'nama'    => trim($input['nama']),
        ], true);

        return ApiResponse::success($this->model->find($id), 'Hari libur dibuat', null, 201);
    }

    public function update($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Hari libur tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $this->model->update($id, [
            'tanggal' => $input['tanggal'],
            'nama'    => trim($input['nama']),
        ]);

        return ApiResponse::success($this->model->find($id), 'Hari libur diperbarui');
    }

    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Hari libur tidak ditemukan', null, 404);
        }

        $this->model->delete($id);

        return ApiResponse::success(null, 'Hari libur dihapus');
    }

    private function rules(?int $id): array
    {
        $ex = $id === null ? '' : ',id,' . $id;

        return [
            'tanggal' => 'required|valid_date[Y-m-d]|is_unique[hari_libur.tanggal' . $ex . ']',
            'nama'    => 'required|min_length[2]|max_length[150]',
        ];
    }

    private function messages(): array
    {
        return [
            'tanggal' => [
                'required'   => 'Tanggal wajib diisi',
                'valid_date' => 'Format tanggal harus YYYY-MM-DD',
                'is_unique'  => 'Tanggal ini sudah terdaftar sebagai hari libur',
            ],
            'nama' => [
                'required'   => 'Nama hari libur wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
            ],
        ];
    }
}