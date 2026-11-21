<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class CorsFilter implements FilterInterface
{
    private function addHeaders(ResponseInterface $res): ResponseInterface
    {
        $origin = service('request')->getHeaderLine('Origin');
        $allowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];
        if (in_array($origin, $allowed, true)) {
            $res->setHeader('Access-Control-Allow-Origin', $origin);
        } else {
            $res->setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        }
        return $res
            ->setHeader('Vary', 'Origin')
            ->setHeader('Access-Control-Allow-Credentials', 'true')
            ->setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
            ->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
    }

    public function before(RequestInterface $request, $arguments = null)
    {
        if (strtolower($request->getMethod()) === 'options') {
            return $this->addHeaders(service('response')->setStatusCode(204));
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $this->addHeaders($response);
    }
}