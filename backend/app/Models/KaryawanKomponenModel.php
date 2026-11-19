<?php

namespace App\Models;

use CodeIgniter\Model;

class KaryawanKomponenModel extends Model
{
    protected $table         = 'karyawan_komponen';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = ['karyawan_id', 'komponen_id', 'nilai'];

    /** Query dasar: komponen milik karyawan beserta info master-nya. */
    public function denganKomponen(): self
    {
        return $this->select(
            'karyawan_komponen.id, karyawan_komponen.karyawan_id, karyawan_komponen.komponen_id, '
            . 'karyawan_komponen.nilai, karyawan_komponen.updated_at, '
            . 'komponen_gaji.kode, komponen_gaji.nama, komponen_gaji.tipe, komponen_gaji.metode, '
            . 'komponen_gaji.nilai AS nilai_default, komponen_gaji.aktif AS komponen_aktif'
        )->join('komponen_gaji', 'komponen_gaji.id = karyawan_komponen.komponen_id');
    }

    public static function format(array $r): array
    {
        $r['nilai']          = (float) $r['nilai'];
        $r['nilai_default']  = $r['nilai_default'] === null ? null : (float) $r['nilai_default'];
        $r['komponen_aktif'] = (bool) $r['komponen_aktif'];
        return $r;
    }
}