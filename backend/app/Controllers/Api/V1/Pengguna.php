<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;

/**
 * Pengguna dan hak akses (kontrak bagian 11): khusus admin_hrd.
 */
class Pengguna extends BaseController
{
    private const ROLE = ['admin_hrd', 'karyawan', 'keuangan', 'pemilik'];

    private function bentuk(array $r): array
    {
        return [
            'id'          => (int) $r['id'],
            'karyawan_id' => $r['karyawan_id'] === null ? null : (int) $r['karyawan_id'],
            'nama'        => $r['nama'],
            'email'       => $r['email'],
            'role'        => $r['role'],
            'aktif'       => (bool) $r['aktif'],
        ];
    }

    private function ambil($id): ?array
    {
        return db_connect()->table('users')->where('id', (int) $id)->get()->getRowArray();
    }

    private function sendiri(): int
    {
        return (int) ((JwtService::$user ?? [])['id'] ?? 0);
    }

    /** Masih ada admin_hrd aktif lain selain user ini? */
    private function adminAktifLain(int $id): bool
    {
        return db_connect()->table('users')->where('role', 'admin_hrd')->where('aktif', 1)->where('id !=', $id)->countAllResults() > 0;
    }

    // GET /api/v1/pengguna?search=&role=&aktif=&page=&per_page=
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) ($this->request->getGet('search') ?? $this->request->getGet('q')));
        $role    = (string) $this->request->getGet('role');
        $aktif   = $this->request->getGet('aktif');

        $b = db_connect()->table('users');
        if ($q !== '') {
            $b->groupStart()->like('nama', $q)->orLike('email', $q)->groupEnd();
        }
        if (in_array($role, self::ROLE, true)) {
            $b->where('role', $role);
        }
        if ($aktif === '0' || $aktif === '1') {
            $b->where('aktif', (int) $aktif);
        }

        $total = $b->countAllResults(false);
        $rows  = $b->orderBy('nama', 'ASC')->orderBy('id', 'ASC')->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();

        return ApiResponse::success(array_map(fn ($r) => $this->bentuk($r), $rows), 'OK', [
            'page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // PUT /api/v1/pengguna/(:num)/role   body: {"role":"keuangan"}
    public function role($id = null)
    {
        $u = $this->ambil($id);
        if (! $u) {
            return ApiResponse::error('NOT_FOUND', 'Pengguna tidak ditemukan', null, 404);
        }

        $in   = $this->request->getJSON(true) ?? [];
        $baru = (string) ($in['role'] ?? '');
        if (! in_array($baru, self::ROLE, true)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['role' => 'Role harus admin_hrd, karyawan, keuangan, atau pemilik'], 422);
        }
        if ((int) $u['id'] === $this->sendiri() && $baru !== $u['role']) {
            return ApiResponse::error('CONFLICT', 'Anda tidak bisa mengubah role akun sendiri', null, 409);
        }
        if ($u['role'] === 'admin_hrd' && $baru !== 'admin_hrd' && ! $this->adminAktifLain((int) $u['id'])) {
            return ApiResponse::error('CONFLICT', 'Harus tersisa minimal satu admin_hrd aktif', null, 409);
        }

        db_connect()->table('users')->where('id', (int) $id)->update(['role' => $baru, 'updated_at' => date('Y-m-d H:i:s')]);

        return ApiResponse::success($this->bentuk($this->ambil($id)), 'Role diperbarui');
    }

    // POST /api/v1/pengguna/(:num)/reset-password
    public function resetPassword($id = null)
    {
        $u = $this->ambil($id);
        if (! $u) {
            return ApiResponse::error('NOT_FOUND', 'Pengguna tidak ditemukan', null, 404);
        }

        $abjad = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        $pw    = '';
        for ($i = 0; $i < 10; $i++) {
            $pw .= $abjad[random_int(0, strlen($abjad) - 1)];
        }

        $db  = db_connect();
        $now = date('Y-m-d H:i:s');
        $db->table('users')->where('id', (int) $id)->update(['password_hash' => password_hash($pw, PASSWORD_DEFAULT), 'updated_at' => $now]);

        // cabut refresh token lama agar sesi lama tidak berlaku
        try {
            $db->table('refresh_tokens')->where('user_id', (int) $id)->where('revoked_at IS NULL', null, false)->update(['revoked_at' => $now]);
        } catch (\Throwable $e) {
            log_message('error', 'Gagal mencabut refresh token: ' . $e->getMessage());
        }

        return ApiResponse::success(['password_sementara' => $pw], 'Password direset');
    }

    // PATCH /api/v1/pengguna/(:num)/status   body: {"aktif": false}
    public function status($id = null)
    {
        $u = $this->ambil($id);
        if (! $u) {
            return ApiResponse::error('NOT_FOUND', 'Pengguna tidak ditemukan', null, 404);
        }

        $in = $this->request->getJSON(true) ?? [];
        if (! array_key_exists('aktif', $in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Aktif wajib diisi (true atau false)'], 422);
        }
        $v = filter_var($in['aktif'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($v === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Nilai aktif harus true atau false'], 422);
        }
        if (! $v) {
            if ((int) $u['id'] === $this->sendiri()) {
                return ApiResponse::error('CONFLICT', 'Anda tidak bisa menonaktifkan akun sendiri', null, 409);
            }
            if ($u['role'] === 'admin_hrd' && ! $this->adminAktifLain((int) $u['id'])) {
                return ApiResponse::error('CONFLICT', 'Harus tersisa minimal satu admin_hrd aktif', null, 409);
            }
        }

        db_connect()->table('users')->where('id', (int) $id)->update(['aktif' => (int) $v, 'updated_at' => date('Y-m-d H:i:s')]);

        return ApiResponse::success($this->bentuk($this->ambil($id)), 'Status pengguna diperbarui');
    }
}