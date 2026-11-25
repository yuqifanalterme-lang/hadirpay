<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class KaryawanKomponenSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $components = array_column(
            $this->db->table('komponen_gaji')->whereIn('kode', ['TUN-TRANSPORT', 'PPH21'])->get()->getResultArray(),
            null,
            'kode'
        );
        $tunjangan = [
            'rina@hadirpay.test' => 245000,
            'andi@hadirpay.test' => 275000,
            'dimas@hadirpay.test' => 300000,
            'budi@hadirpay.test' => 250000,
            'rudi@hadirpay.test' => 220000,
            'siti@hadirpay.test' => 265000,
            'maya@hadirpay.test' => 230000,
            'ratna@hadirpay.test' => 280000,
            'agus@hadirpay.test' => 240000,
            'dewi@hadirpay.test' => 290000,
        ];
        $pph21 = [
            'rina@hadirpay.test' => 35000,
            'andi@hadirpay.test' => 85000,
            'dimas@hadirpay.test' => 110000,
            'budi@hadirpay.test' => 62000,
            'rudi@hadirpay.test' => 52000,
            'siti@hadirpay.test' => 45000,
            'maya@hadirpay.test' => 17000,
            'ratna@hadirpay.test' => 225000,
            'agus@hadirpay.test' => 60000,
            'dewi@hadirpay.test' => 86000,
        ];

        foreach ($this->db->table('karyawan')->orderBy('id')->get()->getResultArray() as $k) {
            $assignments = [
                'TUN-TRANSPORT' => $tunjangan[$k['email']] ?? 0,
                'PPH21' => $pph21[$k['email']] ?? 0,
            ];
            foreach ($assignments as $code => $nilai) {
                $component = $components[$code] ?? null;
                if (! $component) {
                    throw new \RuntimeException('Komponen gaji ' . $code . ' belum tersedia.');
                }
                $existing = $this->db->table('karyawan_komponen')
                    ->where('karyawan_id', $k['id'])->where('komponen_id', $component['id'])
                    ->get()->getRowArray();
                $row = ['nilai' => $nilai, 'updated_at' => $now];
                if ($existing) {
                    $this->db->table('karyawan_komponen')->where('id', $existing['id'])->update($row);
                } else {
                    $this->db->table('karyawan_komponen')->insert($row + [
                        'karyawan_id' => $k['id'],
                        'komponen_id' => $component['id'],
                        'created_at' => $now,
                    ]);
                }
            }

        }

        foreach (['BPJS', 'LEMBUR'] as $kode) {
            $komponen = $this->db->table('komponen_gaji')->where('kode', $kode)->get()->getRowArray();
            if ($komponen) {
                $this->db->table('karyawan_komponen')->where('komponen_id', $komponen['id'])->delete();
            }
        }
    }
}