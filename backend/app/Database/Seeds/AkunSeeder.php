<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class AkunSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $data = [
            ['1-1100', 'Kas/Bank',          'aset',      'debit'],
            ['2-1100', 'Utang Gaji',        'kewajiban', 'kredit'],
            ['2-1200', 'Utang PPh 21',      'kewajiban', 'kredit'],
            ['2-1300', 'Utang Iuran BPJS',  'kewajiban', 'kredit'],
            ['2-1500', 'Utang Potongan Karyawan', 'kewajiban', 'kredit'],
            ['5-1100', 'Beban Gaji',        'beban',     'debit'],
        ];

        $rows = [];
        foreach ($data as [$kode, $nama, $kategori, $saldo]) {
            $rows[] = [
                'kode' => $kode, 'nama' => $nama, 'kategori' => $kategori,
                'saldo_normal' => $saldo, 'sistem' => 1, 'aktif' => 1,
                'created_at' => $now, 'updated_at' => $now,
            ];
        }
        $this->db->table('akun')->ignore(true)->insertBatch($rows);
    }
}