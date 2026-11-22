<?php

namespace App\Filters;

use App\Libraries\CorsHeaders;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class CorsFilter implements FilterInterface
{
    private function addHeaders(ResponseInterface $res): ResponseInterface
    {
        return CorsHeaders::apply($res);
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