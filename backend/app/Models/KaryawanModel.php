<?php

namespace App\Models;

use CodeIgniter\Model;

class KaryawanModel extends Model
{
    protected $table         = 'karyawan';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = [
        'kode', 'nama', 'email', 'no_hp', 'departemen_id', 'jabatan_id',
        'tanggal_mulai', 'jenis_penggajian', 'gaji_pokok', 'tunjangan_tetap',
        'npwp', 'no_bpjs', 'status',
    ];
}