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

        // 6 karyawan demo yang namanya sudah ditentukan dokumen
        $daftar = [
            ['Rina Kartika',    'rina@hadirpay.test',  'HRD',         'Admin HRD',        5500000],
            ['Andi Wijaya',     'andi@hadirpay.test',  'Keuangan',    'Staf Keuangan',    4500000],
            ['Budi Santoso',    'budi@hadirpay.test',  'Gudang',      'Staf Gudang',      4500000],
            ['Siti Rahmawati',  'siti@hadirpay.test',  'Operasional', 'Staf Operasional', 4500000],
            ['Dimas Pratama',   'dimas@hadirpay.test', 'Keuangan',    'Staf Keuangan',    4500000],
            ['Rudi Hartono',    'rudi@hadirpay.test',  'Gudang',      'Staf Gudang',      4500000],
        ];

        // sisa 42 karyawan: departemen => [jumlah, jabatan staf, gaji staf]
        $sisa = [
            'Keuangan'    => [6, 'Staf Keuangan',    4500000],
            'HRD'         => [3, 'Admin HRD',        5000000],
            'Gudang'      => [8, 'Staf Gudang',      3500000],
            'Operasional' => [9, 'Staf Operasional', 4500000],
            'Pemasaran'   => [6, 'Staf Pemasaran',   4500000],
            'Penjualan'   => [6, 'Staf Penjualan',   4500000],
            'IT'          => [4, 'Staf IT',          6500000],
        ];

        $depan    = ['Agus','Bayu','Citra','Dewi','Eko','Fitri','Gilang','Hana','Indra','Joko',
                     'Kartika','Lukman','Maya','Nanda','Oki','Putri','Rizky','Sari','Tono','Wulan'];
        $belakang = ['Saputra','Lestari','Hidayat','Nugroho','Kusuma','Permana','Wibowo','Utami',
                     'Setiawan','Maharani','Firmansyah','Anggraini','Ramadhan','Purnomo','Susanto'];

        $pakai = array_column($daftar, 1, 1);
        $n = 0;
        foreach ($sisa as $d => [$jumlah, $staf, $gaji]) {
            for ($i = 0; $i < $jumlah; $i++, $n++) {
                $nama  = $depan[$n % 20] . ' ' . $belakang[($n * 7 + intdiv($n, 20)) % 15];
                $email = strtolower(str_replace(' ', '.', $nama)) . '@hadirpay.test';
                if (isset($pakai[$email])) {
                    $email = strtolower(str_replace(' ', '.', $nama)) . $n . '@hadirpay.test';
                }
                $pakai[$email] = $email;

                $manajer = ($i === 0 && $d !== 'HRD');
                $daftar[] = [$nama, $email, $d, $manajer ? 'Manajer' : $staf, $manajer ? 8000000 : $gaji];
            }
        }

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