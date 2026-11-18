<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Services\AttendanceService;

class Absensi extends BaseController
{
    private function karyawanId(): ?int
    {
        $id = JwtService::$user['karyawan_id'] ?? null;
        return $id !== null ? (int) $id : null;
    }

    private function tolakTanpaKaryawan()
    {
        return ApiResponse::error('FORBIDDEN', 'Akun ini tidak terhubung dengan data karyawan', null, 403);
    }

    private function body(): array
    {
        try {
            return $this->request->getJSON(true) ?? [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function balas(array $hasil, string $pesan, int $status = 200)
    {
        if (isset($hasil['error'])) {
            [$code, $message, $http, $errors] = $hasil['error'];
            return ApiResponse::error($code, $message, $errors, $http);
        }
        return ApiResponse::success($hasil['data'], $pesan, null, $status);
    }

    public function hariIni()
    {
        $id = $this->karyawanId();
        if ($id === null) return $this->tolakTanpaKaryawan();

        return ApiResponse::success((new AttendanceService())->hariIni($id));
    }

    public function checkIn()
    {
        $id = $this->karyawanId();
        if ($id === null) return $this->tolakTanpaKaryawan();

        $in = $this->body();
        return $this->balas((new AttendanceService())->checkIn($id, $in['latitude'] ?? null, $in['longitude'] ?? null), 'Absen masuk berhasil', 201);
    }

    public function checkOut()
    {
        $id = $this->karyawanId();
        if ($id === null) return $this->tolakTanpaKaryawan();

        $in = $this->body();
        return $this->balas((new AttendanceService())->checkOut($id, $in['latitude'] ?? null, $in['longitude'] ?? null), 'Absen pulang berhasil');
    }

    public function riwayat()
    {
        $id = $this->karyawanId();
        if ($id === null) return $this->tolakTanpaKaryawan();

        $periode = (string) $this->request->getGet('periode');
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periode)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['periode' => ['Periode wajib berformat YYYY-MM']], 422);
        }

        $page    = max(1, (int) $this->request->getGet('page'));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?: 31)));

        $hasil = (new AttendanceService())->riwayat($id, $periode, $page, $perPage);
        return ApiResponse::success($hasil['data'], 'OK', $hasil['meta']);
    }
}