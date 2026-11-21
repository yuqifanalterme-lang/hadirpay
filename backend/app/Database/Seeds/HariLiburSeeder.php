<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class HariLiburSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $rows = [
            ['2026-01-01', 'Tahun Baru'],
            ['2026-03-20', 'Hari Raya Nyepi'],
            ['2026-04-03', 'Wafat Isa Almasih'],
            ['2026-05-01', 'Hari Buruh'],
            ['2026-05-14', 'Kenaikan Isa Almasih'],
            ['2026-06-01', 'Hari Lahir Pancasila'],
            ['2026-08-17', 'Hari Kemerdekaan'],
            ['2026-12-25', 'Hari Raya Natal'],
        ];
        foreach ($rows as [$tanggal, $nama]) {
            if ($this->db->table('hari_libur')->where('tanggal', $tanggal)->countAllResults() > 0) continue;
            $this->db->table('hari_libur')->insert([
                'tanggal' => $tanggal,
                'nama' => $nama,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
