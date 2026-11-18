<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\JabatanModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

class Jabatan extends BaseController
{
    private JabatanModel $model;

    public function __construct()
    {
        $this->model = new JabatanModel();
    }

    private function withDepartemen(): JabatanModel
    {
        return $this->model
            ->select('jabatan.*, departemen.nama AS departemen_nama')
            ->join('departemen', 'departemen.id = jabatan.departemen_id', 'left');
    }

    private function detail($id): ?array
    {
        return $this->withDepartemen()->where('jabatan.id', $id)->first();
    }

    // GET /api/v1/jabatan?page=1&per_page=10&q=staf&departemen_id=1
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) $this->request->getGet('q'));
        $deptId  = (int) ($this->request->getGet('departemen_id') ?? 0);

        $this->withDepartemen();

        if ($q !== '') {
            $this->model->like('jabatan.nama', $q);
        }
        if ($deptId > 0) {
            $this->model->where('jabatan.departemen_id', $deptId);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('jabatan.nama', 'ASC')->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success($rows, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    public function show($id = null)
    {
        $row = $this->detail($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Jabatan tidak ditemukan', null, 404);
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
            'nama'          => trim($input['nama']),
            'departemen_id' => empty($input['departemen_id']) ? null : (int) $input['departemen_id'],
        ], true);

        return ApiResponse::success($this->detail($id), 'Jabatan dibuat', null, 201);
    }

    public function update($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Jabatan tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $this->model->update($id, [
            'nama'          => trim($input['nama']),
            'departemen_id' => empty($input['departemen_id']) ? null : (int) $input['departemen_id'],
        ]);

        return ApiResponse::success($this->detail($id), 'Jabatan diperbarui');
    }

    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Jabatan tidak ditemukan', null, 404);
        }

        try {
            $this->model->delete($id);
        } catch (DatabaseException $e) {
            return ApiResponse::error('IN_USE', 'Jabatan masih dipakai karyawan', null, 409);
        }

        return ApiResponse::success(null, 'Jabatan dihapus');
    }

    private function rules(?int $id): array
    {
        $unique = $id === null ? 'is_unique[jabatan.nama]' : 'is_unique[jabatan.nama,id,' . $id . ']';

        return [
            'nama'          => 'required|min_length[2]|max_length[100]|' . $unique,
            'departemen_id' => 'permit_empty|is_natural_no_zero|is_not_unique[departemen.id]',
        ];
    }

    private function messages(): array
    {
        return [
            'nama' => [
                'required'   => 'Nama jabatan wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
                'max_length' => 'Nama maksimal 100 karakter',
                'is_unique'  => 'Nama jabatan sudah dipakai',
            ],
            'departemen_id' => [
                'is_natural_no_zero' => 'Departemen tidak valid',
                'is_not_unique'      => 'Departemen tidak ditemukan',
            ],
        ];
    }
}