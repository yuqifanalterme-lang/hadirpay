<?php

namespace App\Models;

use CodeIgniter\Model;

class KuotaCutiModel extends Model
{
    protected $table         = 'kuota_cuti';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = ['karyawan_id', 'tahun', 'total', 'terpakai'];

    public const KUOTA_DEFAULT = 12;

    public function ambilAtauBuat(int $karyawanId, int $tahun): array
    {
        $row = $this->where('karyawan_id', $karyawanId)->where('tahun', $tahun)->first();
        if (! $row) {
            $this->insert([
                'karyawan_id' => $karyawanId,
                'tahun'       => $tahun,
                'total'       => self::KUOTA_DEFAULT,
                'terpakai'    => 0,
            ]);
            $row = $this->find($this->getInsertID());
        }
        return $row;
    }

    public static function format(array $r): array
    {
        $r['total']    = (float) $r['total'];
        $r['terpakai'] = (float) $r['terpakai'];
        $r['sisa']     = $r['total'] - $r['terpakai'];
        return $r;
    }
}