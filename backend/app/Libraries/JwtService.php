<?php

namespace App\Libraries;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtService
{
    /** User yang sedang login (diisi oleh AuthFilter). */
    public static ?array $user = null;

    public static function buat(array $user, int $ttl = 3600): string
    {
        $now = time();
        return JWT::encode([
            'iss'  => 'hadirpay',
            'iat'  => $now,
            'exp'  => $now + $ttl,
            'sub'  => (int) $user['id'],
            'role' => $user['role'],
        ], (string) env('JWT_SECRET'), 'HS256');
    }

    public static function baca(string $token): ?object
    {
        try {
            return JWT::decode($token, new Key((string) env('JWT_SECRET'), 'HS256'));
        } catch (\Throwable $e) {
            return null;
        }
    }
}