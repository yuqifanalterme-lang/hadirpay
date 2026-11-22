<?php

namespace App\Libraries;

use CodeIgniter\HTTP\ResponseInterface;

class CorsHeaders
{
    public static function apply(ResponseInterface $response): ResponseInterface
    {
        $origin = service('request')->getHeaderLine('Origin');
        $allowedOrigins = array_filter(array_map(
            'trim',
            explode(',', (string) env(
                'CORS_ALLOWED_ORIGINS',
                'http://localhost:3000,http://127.0.0.1:3000,https://hadirpay.vercel.app',
            )),
        ));

        $response->removeHeader('Access-Control-Allow-Origin');
        if (in_array($origin, $allowedOrigins, true)) {
            $response->setHeader('Access-Control-Allow-Origin', $origin);
        }

        return $response
            ->setHeader('Vary', 'Origin')
            ->setHeader('Access-Control-Allow-Credentials', 'true')
            ->setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
            ->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
    }
}
