<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\DepartemenModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

class Departemen extends BaseController
{
    private const SELECT = 'departemen.*, (SELECT COUNT(*) FROM karyawan k WHERE k.departemen_id = departemen.id) AS jumlah_karyawan';

    private DepartemenModel $model;

    public function __construct()
    {
        $this->model = new DepartemenModel();
    }

    private function bentuk(array $r): array
    {
        return [
            'id'              => (int) $r['id'],
            'nama'            => $r['nama'],
            'jumlah_karyawan' => (int) ($r['jumlah_karyawan'] ?? 0),
        ];
    }

    private function ambil($id): ?array
    {
        $r = $this->model->select(self::SELECT, false)->where('departemen.id', $id)->first();
        return $r ? $this->bentuk($r) : null;
    }

    // GET /api/v1/departemen?search=&page=&per_page=
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) ($this->request->getGet('search') ?? $this->request->getGet('q')));

        if ($q !== '') {
            $this->model->like('departemen.nama', $q);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->select(self::SELECT, false)
            ->orderBy('departemen.nama', 'ASC')
            ->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success(array_map(fn ($r) => $this->bentuk($r), $rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    public function show($id = null)
    {
        $row = $this->ambil($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
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

        $id = $this->model->insert(['nama' => trim($input['nama'])], true);

        return ApiResponse::success($this->ambil($id), 'Departemen dibuat', null, 201);
    }

    public function update($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $this->model->update($id, ['nama' => trim($input['nama'])]);

        return ApiResponse::success($this->ambil($id), 'Departemen diperbarui');
    }

    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }

        try {
            $this->model->delete($id);
        } catch (DatabaseException $e) {
            return ApiResponse::error('CONFLICT', 'Departemen masih dipakai jabatan atau karyawan', null, 409);
        }

        return ApiResponse::success(null, 'Departemen dihapus');
    }

    private function rules(?int $id): array
    {
        $unique = $id === null ? 'is_unique[departemen.nama]' : 'is_unique[departemen.nama,id,' . $id . ']';
        return ['nama' => 'required|min_length[2]|max_length[100]|' . $unique];
    }

    private function messages(): array
    {
        return [
            'nama' => [
                'required'   => 'Nama departemen wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
                'max_length' => 'Nama maksimal 100 karakter',
                'is_unique'  => 'Nama departemen sudah dipakai',
            ],
        ];
    }
}