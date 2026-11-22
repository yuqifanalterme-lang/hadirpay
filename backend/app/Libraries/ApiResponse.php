<?php

namespace App\Libraries;

class ApiResponse
{
    private static function cors($response)
    {
        return CorsHeaders::apply($response);
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