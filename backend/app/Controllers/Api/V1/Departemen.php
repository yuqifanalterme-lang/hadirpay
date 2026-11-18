<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\DepartemenModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

class Departemen extends BaseController
{
    private DepartemenModel $model;

    public function __construct()
    {
        $this->model = new DepartemenModel();
    }

    // GET /api/v1/departemen?page=1&per_page=10&q=keuangan
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) $this->request->getGet('q'));

        if ($q !== '') {
            $this->model->like('nama', $q);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('nama', 'ASC')->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success($rows, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // GET /api/v1/departemen/(:num)
    public function show($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    // POST /api/v1/departemen
    public function create()
    {
        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules([
            'nama' => 'required|min_length[2]|max_length[100]|is_unique[departemen.nama]',
        ], [
            'nama' => [
                'required'   => 'Nama departemen wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
                'max_length' => 'Nama maksimal 100 karakter',
                'is_unique'  => 'Nama departemen sudah dipakai',
            ],
        ]);

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $id = $this->model->insert(['nama' => trim($input['nama'])], true);

        return ApiResponse::success($this->model->find($id), 'Departemen dibuat', null, 201);
    }

    // PUT /api/v1/departemen/(:num)
    public function update($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules([
            'nama' => 'required|min_length[2]|max_length[100]|is_unique[departemen.nama,id,' . (int) $id . ']',
        ], [
            'nama' => [
                'required'   => 'Nama departemen wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
                'max_length' => 'Nama maksimal 100 karakter',
                'is_unique'  => 'Nama departemen sudah dipakai',
            ],
        ]);

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $this->model->update($id, ['nama' => trim($input['nama'])]);

        return ApiResponse::success($this->model->find($id), 'Departemen diperbarui');
    }

    // DELETE /api/v1/departemen/(:num)
    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }

        try {
            $this->model->delete($id);
        } catch (DatabaseException $e) {
            return ApiResponse::error('IN_USE', 'Departemen masih dipakai jabatan atau karyawan', null, 409);
        }

        return ApiResponse::success(null, 'Departemen dihapus');
    }
}