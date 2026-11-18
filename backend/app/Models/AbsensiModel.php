<?php

namespace App\Models;

use CodeIgniter\Model;

class AbsensiModel extends Model
{
    protected $table         = 'absensi';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = [
        'karyawan_id', 'tanggal', 'jam_masuk', 'jam_pulang', 'status',
        'menit_terlambat', 'durasi_menit', 'lembur_menit',
        'lokasi_masuk_lat', 'lokasi_masuk_lng', 'lokasi_pulang_lat', 'lokasi_pulang_lng',
        'dalam_radius', 'lokasi_absensi_id', 'sumber', 'pengajuan_id',
    ];
}