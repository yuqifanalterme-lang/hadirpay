<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class CorsFilter implements FilterInterface
{
    private function addHeaders(ResponseInterface $res): ResponseInterface
    {
        return $res
            ->setHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
            ->setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            ->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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