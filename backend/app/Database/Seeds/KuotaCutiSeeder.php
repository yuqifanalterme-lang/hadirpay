<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class KuotaCutiSeeder extends Seeder
{
    public function run()
    {
        $now  = date('Y-m-d H:i:s');
        $rows = [];
        foreach ($this->db->table('karyawan')->orderBy('id')->get()->getResultArray() as $k) {
            $rows[] = [
                'karyawan_id' => $k['id'],
                'tahun'       => 2026,
                'total'       => 12,
                'terpakai'    => ($k['id'] * 3) % 7,
                'created_at'  => $now,
                'updated_at'  => $now,
            ];
        }
        $this->db->table('kuota_cuti')->ignore(true)->insertBatch($rows);
    }
}