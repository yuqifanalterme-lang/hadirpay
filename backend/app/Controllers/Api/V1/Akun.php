<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\AkunModel;

class Akun extends BaseController
{
    private const KATEGORI = ['aset', 'kewajiban', 'ekuitas', 'pendapatan', 'beban'];

    private AkunModel $model;

    public function __construct()
    {
        $this->model = new AkunModel();
    }

    // GET /api/v1/akun?search=&kategori=&aktif=1&page=1&per_page=100
    public function index()
    {
        $page     = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage  = min(200, max(1, (int) ($this->request->getGet('per_page') ?? 100)));
        $q        = trim((string) $this->request->getGet('search'));
        $kategori = (string) $this->request->getGet('kategori');
        $aktif    = $this->request->getGet('aktif');

        if ($q !== '') {
            $this->model->groupStart()->like('kode', $q)->orLike('nama', $q)->groupEnd();
        }
        if (in_array($kategori, self::KATEGORI, true)) {
            $this->model->where('kategori', $kategori);
        }
        if ($aktif === '0' || $aktif === '1') {
            $this->model->where('aktif', (int) $aktif);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('kode', 'ASC')->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success(array_map(fn ($r) => $this->format($r), $rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // POST /api/v1/akun
    public function create()
    {
        $in = $this->body();

        $validation = service('validation');
        $validation->setRules($this->rules(null), $this->pesan());
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $kategori = $in['kategori'];
        $saldo    = ! empty($in['saldo_normal'])
            ? $in['saldo_normal']
            : (in_array($kategori, ['aset', 'beban'], true) ? 'debit' : 'kredit');

        $id = $this->model->insert([
            'kode'         => trim((string) $in['kode']),
            'nama'         => trim((string) $in['nama']),
            'kategori'     => $kategori,
            'saldo_normal' => $saldo,
            'sistem'       => 0,
            'aktif'        => $this->aktif($in['aktif'] ?? null, 1),
        ], true);

        return ApiResponse::success($this->format($this->model->find($id)), 'Akun dibuat', null, 201);
    }

    // PUT /api/v1/akun/(:num)
    public function update($id = null)
    {
        $akun = $this->model->find($id);
        if (! $akun) {
            return ApiResponse::error('NOT_FOUND', 'Akun tidak ditemukan', null, 404);
        }

        $in = $this->body();

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->pesan());
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $kode     = trim((string) $in['kode']);
        $kategori = $in['kategori'];
        $saldo    = ! empty($in['saldo_normal']) ? $in['saldo_normal'] : $akun['saldo_normal'];
        $aktif    = $this->aktif($in['aktif'] ?? null, (int) $akun['aktif']);

        if ((int) $akun['sistem'] === 1) {
            if ($kode !== $akun['kode'] || $kategori !== $akun['kategori'] || $saldo !== $akun['saldo_normal']) {
                return ApiResponse::error('SYSTEM_ACCOUNT', 'Kode, kategori, dan saldo normal akun sistem tidak boleh diubah', null, 409);
            }
            if ($aktif === 0) {
                return ApiResponse::error('SYSTEM_ACCOUNT', 'Akun sistem dipakai jurnal otomatis, tidak boleh dinonaktifkan', null, 409);
            }
        } elseif ($this->punyaJurnal((int) $id) && ($kategori !== $akun['kategori'] || $saldo !== $akun['saldo_normal'])) {
            return ApiResponse::error('IN_USE', 'Akun sudah punya jurnal, kategori dan saldo normal tidak boleh diubah', null, 409);
        }

        $this->model->update($id, [
            'kode'         => $kode,
            'nama'         => trim((string) $in['nama']),
            'kategori'     => $kategori,
            'saldo_normal' => $saldo,
            'aktif'        => $aktif,
        ]);

        return ApiResponse::success($this->format($this->model->find($id)), 'Akun diperbarui');
    }

    // DELETE /api/v1/akun/(:num)
    public function delete($id = null)
    {
        $akun = $this->model->find($id);
        if (! $akun) {
            return ApiResponse::error('NOT_FOUND', 'Akun tidak ditemukan', null, 404);
        }
        if ((int) $akun['sistem'] === 1) {
            return ApiResponse::error('SYSTEM_ACCOUNT', 'Akun sistem tidak boleh dihapus', null, 409);
        }
        if ($this->punyaJurnal((int) $id)) {
            return ApiResponse::error('IN_USE', 'Akun sudah punya jurnal, nonaktifkan saja', null, 409);
        }

        $this->model->delete($id);
        return ApiResponse::success(null, 'Akun dihapus');
    }

    // ---------- helper ----------

    private function format(array $r): array
    {
        return [
            'id'           => (int) $r['id'],
            'kode'         => $r['kode'],
            'nama'         => $r['nama'],
            'kategori'     => $r['kategori'],
            'saldo_normal' => $r['saldo_normal'],
            'aktif'        => (bool) $r['aktif'],
            'sistem'       => (bool) $r['sistem'],
        ];
    }

    private function punyaJurnal(int $akunId): bool
    {
        return db_connect()->table('detail_jurnal')->where('akun_id', $akunId)->countAllResults() > 0;
    }

    private function aktif($value, int $default): int
    {
        if ($value === null) {
            return $default;
        }
        return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }

    private function rules(?int $id): array
    {
        $ex = $id === null ? '' : ',id,' . $id;

        return [
            'kode'         => 'required|max_length[10]|is_unique[akun.kode' . $ex . ']',
            'nama'         => 'required|min_length[2]|max_length[100]',
            'kategori'     => 'required|in_list[aset,kewajiban,ekuitas,pendapatan,beban]',
            'saldo_normal' => 'permit_empty|in_list[debit,kredit]',
        ];
    }

    private function pesan(): array
    {
        return [
            'kode' => [
                'required'   => 'Kode akun wajib diisi',
                'max_length' => 'Kode maksimal 10 karakter',
                'is_unique'  => 'Kode akun sudah dipakai',
            ],
            'nama' => [
                'required'   => 'Nama akun wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
            ],
            'kategori' => [
                'required' => 'Kategori wajib diisi',
                'in_list'  => 'Kategori harus aset, kewajiban, ekuitas, pendapatan, atau beban',
            ],
            'saldo_normal' => [
                'in_list' => 'Saldo normal harus debit atau kredit',
            ],
        ];
    }

    private function body(): array
    {
        try {
            return $this->request->getJSON(true) ?? [];
        } catch (\Throwable $e) {
            return [];
        }
    }
}