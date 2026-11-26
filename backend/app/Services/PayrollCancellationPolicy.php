<?php

namespace App\Services;

class PayrollCancellationPolicy
{
    /** @return array{code:string, message:string, status:int, errors?:array<string,string>}|null */
    public static function error(string $role, array $period, string $reason): ?array
    {
        if (! in_array($role, ['admin_hrd', 'keuangan'], true)) {
            return [
                'code'    => 'FORBIDDEN',
                'message' => 'Anda tidak berhak membatalkan penggajian',
                'status'  => 403,
            ];
        }
        if (trim($reason) === '' || mb_strlen(trim($reason)) > 255) {
            return [
                'code'    => 'VALIDATION_ERROR',
                'message' => 'Data tidak valid',
                'status'  => 422,
                'errors'  => ['catatan' => 'Alasan pembatalan wajib diisi (maksimal 255 karakter)'],
            ];
        }
        if ($period['status'] === 'dibatalkan') {
            return [
                'code'    => 'INVALID_STATUS_TRANSITION',
                'message' => 'Penggajian sudah dibatalkan',
                'status'  => 409,
            ];
        }
        if (! in_array($period['status'], ['disetujui', 'dibayar'], true)) {
            return [
                'code'    => 'INVALID_STATUS_TRANSITION',
                'message' => 'Hanya penggajian disetujui atau dibayar yang dapat dibatalkan',
                'status'  => 409,
            ];
        }
        return null;
    }
}
