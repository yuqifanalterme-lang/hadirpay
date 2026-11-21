<?php

namespace App\Libraries;

class ApiResponse
{
    private static function cors($response)
    {
        $origin = service('request')->getHeaderLine('Origin');
        $allowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];
        $allowOrigin = in_array($origin, $allowed, true) ? $origin : 'http://localhost:3000';
        return $response
            ->setHeader('Access-Control-Allow-Origin', $allowOrigin)
            ->setHeader('Vary', 'Origin')
            ->setHeader('Access-Control-Allow-Credentials', 'true')
            ->setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
            ->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
    }

    /**
     * @param array<string, mixed> $extra field tambahan di level atas, mis. ringkasan, jumlah_belum_dibaca
     */
    public static function success($data = null, string $message = 'OK', ?array $meta = null, int $status = 200, array $extra = [])
    {
        $body = ['success' => true, 'message' => $message, 'data' => $data];
        if ($meta !== null) {
            $body['meta'] = $meta;
        }
        foreach ($extra as $k => $v) {
            $body[$k] = $v;
        }
        $response = service('response')->setStatusCode($status)->setJSON($body);
        return self::cors($response);
    }

    /** errors selalu berbentuk { field: [pesan, ...] } sesuai kontrak bagian 1.4 */
    public static function error(string $code, string $message, ?array $errors = null, int $status = 400)
    {
        $body = ['success' => false, 'code' => $code, 'message' => $message];
        if ($errors !== null) {
            $rapi = [];
            foreach ($errors as $field => $pesan) {
                $rapi[$field] = is_array($pesan) ? array_values($pesan) : [(string) $pesan];
            }
            $body['errors'] = $rapi;
        }
        $response = service('response')->setStatusCode($status)->setJSON($body);
        return self::cors($response);
    }
}