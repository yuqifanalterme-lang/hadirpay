<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\LokasiAbsensiModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

class LokasiAbsensi extends BaseController
{
    private LokasiAbsensiModel $model;

    public function __construct()
    {
        $this->model = new LokasiAbsensiModel();
    }

    // GET /api/v1/lokasi-absensi?page=1&per_page=10&q=kantor&aktif=1
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) $this->request->getGet('q'));
        $aktif   = $this->request->getGet('aktif');

        if ($q !== '') {
            $this->model->groupStart()
                ->like('nama', $q)
                ->orLike('alamat', $q)
                ->groupEnd();
        }
        if ($aktif === '0' || $aktif === '1') {
            $this->model->where('aktif', (int) $aktif);
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

    public function show($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Lokasi tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    public function create()
    {
        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules(), $this->messages());

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $id = $this->model->insert($this->payload($input, null), true);

        return ApiResponse::success($this->model->find($id), 'Lokasi dibuat', null, 201);
    }

    public function update($id = null)
    {
        $lama = $this->model->find($id);
        if (! $lama) {
            return ApiResponse::error('NOT_FOUND', 'Lokasi tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules(), $this->messages());

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $this->model->update($id, $this->payload($input, $lama));

        return ApiResponse::success($this->model->find($id), 'Lokasi diperbarui');
    }

    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Lokasi tidak ditemukan', null, 404);
        }

        try {
            $this->model->delete($id);
        } catch (DatabaseException $e) {
            return ApiResponse::error('IN_USE', 'Lokasi masih dipakai data lain, nonaktifkan saja', null, 409);
        }

        return ApiResponse::success(null, 'Lokasi dihapus');
    }

    private function bool($value, int $default): int
    {
        if ($value === null) {
            return $default;
        }
        return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }

    private function payload(array $in, ?array $lama): array
    {
        return [
            'nama'         => trim($in['nama']),
            'alamat'       => isset($in['alamat']) && $in['alamat'] !== '' ? trim((string) $in['alamat']) : null,
            'latitude'     => $in['latitude'],
            'longitude'    => $in['longitude'],
            'radius_meter' => isset($in['radius_meter']) ? (int) $in['radius_meter'] : (int) ($lama['radius_meter'] ?? 100),
            'wajib_lokasi' => $this->bool($in['wajib_lokasi'] ?? null, (int) ($lama['wajib_lokasi'] ?? 0)),
            'aktif'        => $this->bool($in['aktif'] ?? null, (int) ($lama['aktif'] ?? 1)),
        ];
    }

    private function rules(): array
    {
        return [
            'nama'         => 'required|min_length[2]|max_length[100]',
            'alamat'       => 'permit_empty|max_length[255]',
            'latitude'     => 'required|numeric|greater_than_equal_to[-90]|less_than_equal_to[90]',
            'longitude'    => 'required|numeric|greater_than_equal_to[-180]|less_than_equal_to[180]',
            'radius_meter' => 'permit_empty|is_natural_no_zero|less_than_equal_to[5000]',
        ];
    }

    private function messages(): array
    {
        return [
            'nama' => [
                'required'   => 'Nama lokasi wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
            ],
            'latitude' => [
                'required'               => 'Latitude wajib diisi',
                'numeric'                => 'Latitude harus angka',
                'greater_than_equal_to'  => 'Latitude minimal -90',
                'less_than_equal_to'     => 'Latitude maksimal 90',
            ],
            'longitude' => [
                'required'               => 'Longitude wajib diisi',
                'numeric'                => 'Longitude harus angka',
                'greater_than_equal_to'  => 'Longitude minimal -180',
                'less_than_equal_to'     => 'Longitude maksimal 180',
            ],
            'radius_meter' => [
                'is_natural_no_zero' => 'Radius harus bilangan bulat lebih dari 0',
                'less_than_equal_to' => 'Radius absensi maksimal 5.000 meter',
            ],
        ];
    }
}