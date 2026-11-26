<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class KomponenGajiSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        // kode, nama, tipe, metode, nilai, aktif
        $data = [
            ['TUN-TRANSPORT', 'Tunjangan transport',    'pendapatan', 'nominal_tetap', null,   1],
            ['POT-ALPHA',     'Potongan alpha',         'potongan',   'per_hari',      null,   1],
            ['POT-TELAT',     'Potongan keterlambatan', 'potongan',   'per_menit',     1000,   1],
            ['BPJS',          'Iuran BPJS',             'potongan',   'persen',        3,      1],
            ['PPH21',         'PPh 21',                 'potongan',   'nominal_tetap', null,   1],
            ['POT-LEMBUR',    'Potongan lembur per periode', 'potongan', 'nominal_tetap', 0, 1],
            ['POT-LAIN',      'Potongan lainnya',       'potongan',   'nominal_tetap', 0,      1],
        ];

        foreach ($data as [$kode, $nama, $tipe, $metode, $nilai, $aktif]) {
            $row = [
                'kode' => $kode, 'nama' => $nama, 'tipe' => $tipe, 'metode' => $metode,
                'nilai' => $nilai, 'keterangan' => null, 'sistem' => 1, 'aktif' => $aktif,
                'created_at' => $now, 'updated_at' => $now,
            ];
            $existing = $this->db->table('komponen_gaji')->where('kode', $kode)->get()->getRowArray();
            if ($existing) {
                unset($row['created_at']);
                $this->db->table('komponen_gaji')->where('id', $existing['id'])->update($row);
            } else {
                $this->db->table('komponen_gaji')->insert($row);
            }
        }

        $this->db->table('komponen_gaji')->where('kode', 'LEMBUR')->update([
            'metode' => 'nominal_tetap',
            'nilai' => null,
            'aktif' => 0,
            'updated_at' => $now,
        ]);
    }
}