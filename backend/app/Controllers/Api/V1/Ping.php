<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;

class Ping extends BaseController
{
    public function index()
    {
        return ApiResponse::success(['waktu' => date('c')], 'HADIRPAY API aktif');
    }
}