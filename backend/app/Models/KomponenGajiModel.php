<?php

namespace App\Models;

use CodeIgniter\Model;

class KomponenGajiModel extends Model
{
    protected $table         = 'komponen_gaji';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = ['kode', 'nama', 'tipe', 'metode', 'nilai', 'keterangan', 'sistem', 'aktif'];

    public const TIPE   = ['pendapatan', 'potongan'];
    public const METODE = ['nominal_tetap', 'persen', 'per_hari', 'per_menit'];

    public static function format(array $r): array
    {
        $r['nilai']  = $r['nilai'] === null ? null : (float) $r['nilai'];
        $r['sistem'] = (bool) $r['sistem'];
        $r['aktif']  = (bool) $r['aktif'];
        return $r;
    }
}