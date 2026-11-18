<?php

namespace App\Models;

use CodeIgniter\Model;

class LokasiAbsensiModel extends Model
{
    protected $table         = 'lokasi_absensi';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = [
        'nama', 'alamat', 'latitude', 'longitude',
        'radius_meter', 'wajib_lokasi', 'aktif',
    ];
}