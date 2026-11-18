<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class JabatanDepartemenSeeder extends Seeder
{
    public function run()
    {
        $now  = date('Y-m-d H:i:s');
        $dept = array_column($this->db->table('departemen')->get()->getResultArray(), 'id', 'nama');

        // [nama jabatan, nama departemen (null = lintas departemen)]
        $data = [
            ['Admin HRD',           'HRD'],
            ['Staf Keuangan',       'Keuangan'],
            ['Staf Gudang',         'Gudang'],
            ['Staf Operasional',    'Operasional'],
            ['Staf Pemasaran',      'Pemasaran'],
            ['Staf Penjualan',      'Penjualan'],
            ['Staf IT',             'IT'],
            ['Manajer Keuangan',    'Keuangan'],
            ['Manajer HRD',         'HRD'],
            ['Manajer Gudang',      'Gudang'],
            ['Manajer Operasional', 'Operasional'],
            ['Manajer Pemasaran',   'Pemasaran'],
            ['Manajer Penjualan',   'Penjualan'],
            ['Manajer IT',          'IT'],
            ['Pemilik',             null],
        ];

        foreach ($data as [$nama, $namaDept]) {
            $deptId   = $namaDept !== null ? ($dept[$namaDept] ?? null) : null;
            $existing = $this->db->table('jabatan')->where('nama', $nama)->get()->getRowArray();

            if ($existing) {
                $this->db->table('jabatan')->where('id', $existing['id'])->update([
                    'departemen_id' => $deptId,
                    'updated_at'    => $now,
                ]);
            } else {
                $this->db->table('jabatan')->insert([
                    'nama'          => $nama,
                    'departemen_id' => $deptId,
                    'created_at'    => $now,
                    'updated_at'    => $now,
                ]);
            }
        }
    }
}