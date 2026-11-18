<?php

namespace App\Filters;

use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class AuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $header = $request->getHeaderLine('Authorization');
        if (! preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return ApiResponse::error('UNAUTHENTICATED', 'Token tidak ditemukan', null, 401);
        }

        $payload = JwtService::baca($m[1]);
        if (! $payload) {
            return ApiResponse::error('UNAUTHENTICATED', 'Token tidak valid atau kedaluwarsa', null, 401);
        }

        $user = db_connect()->table('users')->where('id', $payload->sub)->where('aktif', 1)->get()->getRowArray();
        if (! $user) {
            return ApiResponse::error('UNAUTHENTICATED', 'Akun tidak aktif', null, 401);
        }

        JwtService::$user = $user;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }
}