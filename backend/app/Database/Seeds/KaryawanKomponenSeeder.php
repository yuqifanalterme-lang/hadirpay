<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class KaryawanKomponenSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $komp = $this->db->table('komponen_gaji')->where('kode', 'TUN-TRANSPORT')->get()->getRowArray();

        $rows = [];
        foreach ($this->db->table('karyawan')->orderBy('id')->get()->getResultArray() as $k) {
            $rows[] = [
                'karyawan_id' => $k['id'],
                'komponen_id' => $komp['id'],
                'nilai'       => 245000,
                'created_at'  => $now,
                'updated_at'  => $now,
            ];
        }
        $this->db->table('karyawan_komponen')->ignore(true)->insertBatch($rows);
    }
}