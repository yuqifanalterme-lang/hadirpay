<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class JabatanSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $nama = [
            'Admin HRD', 'Manajer', 'Staf Keuangan', 'Staf Gudang', 'Staf Operasional',
            'Staf Pemasaran', 'Staf Penjualan', 'Staf IT', 'Pemilik',
        ];

        $rows = [];
        foreach ($nama as $n) {
            $rows[] = ['nama' => $n, 'created_at' => $now, 'updated_at' => $now];
        }
        $this->db->table('jabatan')->ignore(true)->insertBatch($rows);
    }
}