<?php

namespace App\Models;

use CodeIgniter\Model;

class PeriodeGajiModel extends Model
{
    protected $table         = 'periode_gaji';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = [
        'periode', 'tanggal_mulai', 'tanggal_selesai', 'tanggal_tutup', 'hari_kerja',
        'status', 'tanggal_bayar', 'dibuat_oleh', 'dihitung_pada',
    ];

    public const STATUS = ['draft', 'menunggu_validasi', 'disetujui', 'dibayar'];

    public static function format(array $r): array
    {
        $r['hari_kerja'] = (int) $r['hari_kerja'];
        return $r;
    }
}