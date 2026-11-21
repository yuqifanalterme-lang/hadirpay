<?php

namespace App\Filters;

use App\Libraries\ApiResponse;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class JsonRequestFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $contentType = strtolower($request->getHeaderLine('Content-Type'));
        if (str_contains($contentType, 'application/json')) {
            $raw = (string) $request->getBody();
            if ($raw !== '' && json_decode($raw, true) === null && json_last_error() !== JSON_ERROR_NONE) {
                return ApiResponse::error(
                    'BAD_REQUEST',
                    'Format JSON tidak valid',
                    ['body' => ['Body request harus berupa JSON yang valid']],
                    400
                );
            }
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $response;
    }
}
