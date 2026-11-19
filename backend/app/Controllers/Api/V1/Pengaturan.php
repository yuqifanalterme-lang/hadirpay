<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\PengaturanModel;

class Pengaturan extends BaseController
{
    private PengaturanModel $model;

    public function __construct()
    {
        $this->model = new PengaturanModel();
    }

    // GET /api/v1/pengaturan  ->  { "key": value, ... }
    public function index()
    {
        return ApiResponse::success((object) $this->model->semua());
    }

    // GET /api/v1/pengaturan/(:segment)
    public function show($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Key tidak valid', ['key' => $this->pesanKey()], 422);
        }

        $row = $this->model->ambil($key);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Pengaturan tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    // PUT /api/v1/pengaturan/(:segment)   body: {"value": ...}
    public function simpan($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Key tidak valid', ['key' => $this->pesanKey()], 422);
        }

        $in = $this->request->getJSON(true) ?? [];
        if (! array_key_exists('value', $in) || $in['value'] === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['value' => 'Value wajib diisi'], 422);
        }

        $this->model->simpan($key, $in['value']);

        return ApiResponse::success($this->model->ambil($key), 'Pengaturan disimpan');
    }

    // PUT /api/v1/pengaturan   body: {"pengaturan": {"key1": value, "key2": value}}
    public function simpanMassal()
    {
        $in   = $this->request->getJSON(true) ?? [];
        $data = $in['pengaturan'] ?? null;

        if (! is_array($data) || $data === []) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'pengaturan' => 'Kirim objek {"key": value, ...} yang tidak kosong',
            ], 422);
        }
        if (count($data) > 50) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['pengaturan' => 'Maksimal 50 key sekali simpan'], 422);
        }

        $errors = [];
        foreach ($data as $k => $v) {
            if (! $this->keyValid((string) $k)) {
                $errors[(string) $k] = $this->pesanKey();
            } elseif ($v === null) {
                $errors[(string) $k] = 'Value wajib diisi';
            }
        }
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $db = db_connect();
        $db->transBegin();
        try {
            foreach ($data as $k => $v) {
                $this->model->simpan((string) $k, $v);
            }
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal simpan pengaturan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan pengaturan', null, 500);
        }

        return ApiResponse::success((object) $this->model->semua(), 'Pengaturan disimpan');
    }

    // DELETE /api/v1/pengaturan/(:segment)
    public function delete($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key) || ! $this->model->ambil($key)) {
            return ApiResponse::error('NOT_FOUND', 'Pengaturan tidak ditemukan', null, 404);
        }

        $this->model->hapus($key);
        return ApiResponse::success(null, 'Pengaturan dihapus');
    }

    // ---------- helper ----------

    private function keyValid(string $key): bool
    {
        return (bool) preg_match('/^[a-zA-Z0-9_.\-]{1,80}$/', $key);
    }

    private function pesanKey(): string
    {
        return 'Key hanya boleh huruf, angka, titik, strip, dan underscore (maksimal 80 karakter)';
    }
}