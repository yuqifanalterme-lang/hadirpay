<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;

class Auth extends BaseController
{
    private const ACCESS_TTL  = 3600;           // 60 menit
    private const REFRESH_TTL = 7 * 24 * 3600;  // 7 hari

    private const MENU = [
        'admin_hrd' => ['dashboard', 'absensi', 'pengajuan', 'karyawan', 'penggajian', 'akuntansi', 'laporan', 'pengaturan'],
        'karyawan'  => ['dashboard', 'absensi', 'pengajuan', 'slip_gaji'],
        'keuangan'  => ['dashboard', 'absensi', 'pengajuan', 'penggajian', 'akuntansi', 'laporan'],
        'pemilik'   => ['dashboard', 'karyawan', 'penggajian', 'akuntansi', 'laporan'],
    ];

    public function login()
    {
        $in = $this->request->getJSON(true) ?? [];

        $errors = [];
        if (empty($in['email']))    $errors['email']    = ['Email wajib diisi'];
        if (empty($in['password'])) $errors['password'] = ['Password wajib diisi'];
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $db   = db_connect();
        $user = $db->table('users')->where('email', trim($in['email']))->get()->getRowArray();

        if (! $user || ! $user['aktif'] || ! password_verify($in['password'], $user['password_hash'])) {
            return ApiResponse::error('INVALID_CREDENTIALS', 'Email atau password salah', null, 401);
        }

        $db->table('users')->where('id', $user['id'])->update(['last_login_at' => date('Y-m-d H:i:s')]);

        return ApiResponse::success([
            'access_token'  => JwtService::buat($user, self::ACCESS_TTL),
            'refresh_token' => $this->buatRefreshToken((int) $user['id']),
            'expires_in'    => self::ACCESS_TTL,
            'user'          => $this->profil((int) $user['id']),
        ], 'Login berhasil');
    }

    public function refresh()
    {
        $in = $this->request->getJSON(true) ?? [];
        if (empty($in['refresh_token'])) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['refresh_token' => ['Refresh token wajib diisi']], 422);
        }

        $db  = db_connect();
        $row = $db->table('refresh_tokens')
            ->where('token_hash', hash('sha256', $in['refresh_token']))
            ->where('revoked_at', null)
            ->where('expires_at >', date('Y-m-d H:i:s'))
            ->get()->getRowArray();

        $user = $row ? $db->table('users')->where('id', $row['user_id'])->where('aktif', 1)->get()->getRowArray() : null;
        if (! $user) {
            return ApiResponse::error('UNAUTHENTICATED', 'Refresh token tidak valid atau kedaluwarsa', null, 401);
        }

        return ApiResponse::success([
            'access_token' => JwtService::buat($user, self::ACCESS_TTL),
            'expires_in'   => self::ACCESS_TTL,
        ], 'Token diperbarui');
    }

    public function logout()
    {
        db_connect()->table('refresh_tokens')
            ->where('user_id', JwtService::$user['id'])
            ->where('revoked_at', null)
            ->update(['revoked_at' => date('Y-m-d H:i:s')]);

        return ApiResponse::success(null, 'Logout berhasil');
    }

    public function me()
    {
        $profil = $this->profil((int) JwtService::$user['id']);
        $profil['menu_access'] = self::MENU[$profil['role']] ?? ['dashboard'];

        return ApiResponse::success($profil);
    }

    public function password()
    {
        $in   = $this->request->getJSON(true) ?? [];
        $user = JwtService::$user;

        $errors = [];
        if (empty($in['password_lama'])) {
            $errors['password_lama'] = ['Password lama wajib diisi'];
        } elseif (! password_verify($in['password_lama'], $user['password_hash'])) {
            $errors['password_lama'] = ['Password lama salah'];
        }
        if (empty($in['password_baru']) || strlen($in['password_baru']) < 8) {
            $errors['password_baru'] = ['Password baru minimal 8 karakter'];
        }
        if (($in['konfirmasi_password'] ?? null) !== ($in['password_baru'] ?? '')) {
            $errors['konfirmasi_password'] = ['Konfirmasi password tidak sama'];
        }
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $db = db_connect();
        $db->table('users')->where('id', $user['id'])->update([
            'password_hash' => password_hash($in['password_baru'], PASSWORD_DEFAULT),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);
        $db->table('refresh_tokens')->where('user_id', $user['id'])->where('revoked_at', null)
            ->update(['revoked_at' => date('Y-m-d H:i:s')]);

        return ApiResponse::success(null, 'Password berhasil diubah');
    }

    // ---------- helper ----------

    private function buatRefreshToken(int $userId): string
    {
        $token = bin2hex(random_bytes(32));
        db_connect()->table('refresh_tokens')->insert([
            'user_id'    => $userId,
            'token_hash' => hash('sha256', $token),
            'expires_at' => date('Y-m-d H:i:s', time() + self::REFRESH_TTL),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
        return $token;
    }

    private function profil(int $userId): array
    {
        $row = db_connect()->table('users u')
            ->select('u.id, u.karyawan_id, u.nama, u.email, u.role, j.nama AS jabatan')
            ->join('karyawan k', 'k.id = u.karyawan_id', 'left')
            ->join('jabatan j', 'j.id = k.jabatan_id', 'left')
            ->where('u.id', $userId)
            ->get()->getRowArray();

        $kata    = preg_split('/\s+/', trim($row['nama']));
        $inisial = strtoupper(mb_substr($kata[0], 0, 1) . (isset($kata[1]) ? mb_substr($kata[1], 0, 1) : ''));

        return [
            'id'          => (int) $row['id'],
            'karyawan_id' => $row['karyawan_id'] !== null ? (int) $row['karyawan_id'] : null,
            'nama'        => $row['nama'],
            'email'       => $row['email'],
            'role'        => $row['role'],
            'jabatan'     => $row['jabatan'] ?? ($row['role'] === 'pemilik' ? 'Pemilik' : null),
            'inisial'     => $inisial,
            'foto_url'    => null,
        ];
    }
}