<?php

namespace App\Libraries;

class ApiResponse
{
    public static function success($data = null, string $message = 'OK', ?array $meta = null, int $status = 200)
    {
        $body = ['success' => true, 'message' => $message, 'data' => $data];
        if ($meta !== null) {
            $body['meta'] = $meta;
        }
        return service('response')->setStatusCode($status)->setJSON($body);
    }

    public static function error(string $code, string $message, ?array $errors = null, int $status = 400)
    {
        $body = ['success' => false, 'code' => $code, 'message' => $message];
        if ($errors !== null) {
            $body['errors'] = $errors;
        }
        return service('response')->setStatusCode($status)->setJSON($body);
    }
}