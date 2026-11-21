<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class JadwalKerjaSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        if ($this->db->table('jadwal_kerja')->countAllResults() > 0) return;
        $this->db->table('jadwal_kerja')->insert([
            'nama'            => 'Reguler',
            'jam_masuk'       => '08:00:00',
            'jam_pulang'      => '17:00:00',
            'toleransi_menit' => 0,
            'hari_kerja'      => 'senin,selasa,rabu,kamis,jumat',
            'is_default'      => 1,
            'created_at'      => $now,
            'updated_at'      => $now,
        ]);
    }
}