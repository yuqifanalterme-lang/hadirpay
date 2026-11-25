<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class KaryawanSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $dep = array_column($this->db->table('departemen')->get()->getResultArray(), 'id', 'nama');
        $jab = array_column($this->db->table('jabatan')->get()->getResultArray(), 'id', 'nama');

        $daftar = [
            ['Rina Kartika',    'rina@hadirpay.test',  'HRD',         'Admin HRD',        5500000],
            ['Andi Wijaya',     'andi@hadirpay.test',  'Keuangan',    'Staf Keuangan',    4500000],
            ['Dimas Pratama',   'dimas@hadirpay.test', 'Keuangan',    'Staf Keuangan',    4500000],
            ['Budi Santoso',    'budi@hadirpay.test',  'Gudang',      'Staf Gudang',      4500000],
            ['Rudi Hartono',    'rudi@hadirpay.test',  'Gudang',      'Staf Gudang',      4500000],
            ['Siti Rahmawati',  'siti@hadirpay.test',  'Operasional', 'Staf Operasional', 4500000],
            ['Maya Lestari',    'maya@hadirpay.test',  'Pemasaran',   'Staf Pemasaran',   4500000],
            ['Ratna Puspita',   'ratna@hadirpay.test', 'Pemasaran',   'Staf Pemasaran',   4500000],
            ['Agus Saputra',    'agus@hadirpay.test',  'Penjualan',   'Staf Penjualan',   4500000],
            ['Dewi Anggraini',  'dewi@hadirpay.test',  'IT',          'Staf IT',          6500000],
        ];

        $rows = [];
        foreach ($daftar as $idx => [$nama, $email, $d, $j, $gaji]) {
            $rows[] = [
                'kode'             => sprintf('KRY-%04d', $idx + 1),
                'nama'             => $nama,
                'email'            => $email,
                'no_hp'            => sprintf('0812%07d', (1000000 + $idx * 137311) % 9000000),
                'departemen_id'    => $dep[$d],
                'jabatan_id'       => $jab[$j],
                'tanggal_mulai'    => sprintf('%d-%02d-%02d', 2019 + ($idx % 7), 1 + ($idx * 5 % 12), 1 + ($idx * 7 % 28)),
                'jenis_penggajian' => 'bulanan',
                'gaji_pokok'       => $gaji,
                'tunjangan_tetap'  => 0,
                'npwp'             => null,
                'no_bpjs'          => null,
                'status'           => 'aktif',
                'created_at'       => $now,
                'updated_at'       => $now,
            ];
        }
        $this->db->table('karyawan')->ignore(true)->insertBatch($rows);
    }
}