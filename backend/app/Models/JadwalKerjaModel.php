<?php

namespace App\Models;

use CodeIgniter\Model;

class JadwalKerjaModel extends Model
{
    protected $table         = 'jadwal_kerja';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = [
        'nama', 'jam_masuk', 'jam_pulang', 'toleransi_menit', 'hari_kerja', 'is_default',
    ];
}