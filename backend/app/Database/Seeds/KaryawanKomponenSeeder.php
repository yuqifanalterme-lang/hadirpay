<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class KaryawanKomponenSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $components = array_column(
            $this->db->table('komponen_gaji')->whereIn('kode', ['TUN-TRANSPORT', 'BPJS', 'PPH21'])->get()->getResultArray(),
            null,
            'kode'
        );
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

        $kodeDemo = array_map(static fn ($n) => sprintf('KRY-%04d', $n), range(1, 10));
        foreach ($this->db->table('karyawan')->whereIn('kode', $kodeDemo)->orderBy('id')->get()->getResultArray() as $k) {
            $assignments = [
                'TUN-TRANSPORT' => 245000,
                'BPJS' => 3,
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
                if (! $existing) {
                    $this->db->table('karyawan_komponen')->insert([
                        'karyawan_id' => $k['id'],
                        'komponen_id' => $component['id'],
                        'nilai'       => $nilai,
                        'created_at'  => $now,
                        'updated_at'  => $now,
                    ]);
                }
            }
        }
    }
}