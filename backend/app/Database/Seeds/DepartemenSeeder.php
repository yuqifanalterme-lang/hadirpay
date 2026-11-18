<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class DepartemenSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $nama = ['Keuangan', 'HRD', 'Gudang', 'Operasional', 'Pemasaran', 'Penjualan', 'IT'];

        $rows = [];
        foreach ($nama as $n) {
            $rows[] = ['nama' => $n, 'created_at' => $now, 'updated_at' => $now];
        }
        $this->db->table('departemen')->insertBatch($rows);
    }
}