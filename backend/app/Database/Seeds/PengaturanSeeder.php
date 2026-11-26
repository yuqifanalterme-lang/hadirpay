<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class PengaturanSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $rows = [
            'perusahaan' => [
                'nama' => 'PT Contoh Sejahtera',
                'alamat' => 'Jl. Sudirman No. 21, Jakarta',
                'npwp' => null,
                'logo_url' => null,
            ],
            'jadwal_kerja' => [
                'jam_masuk' => '08:00',
                'jam_pulang' => '17:00',
                'toleransi_menit' => 0,
                'hari_kerja' => ['senin', 'selasa', 'rabu', 'kamis', 'jumat'],
            ],
            'kebijakan_gaji' => [
                'metode_potongan_alpha' => 'tarif_harian',
                'pembagi_hari_kerja' => 'hari_kerja_periode',
                'tanggal_tutup_periode' => 25,
                'potongan_izin_tanpa_surat' => false,
                'potongan_terlambat_per_keterlambatan' => 1000,
            ],
            'kuota_cuti_tahunan' => 12,
        ];
        foreach ($rows as $key => $value) {
            $exists = $this->db->table('pengaturan')->where('key', $key)->countAllResults();
            if ($exists > 0) continue;
            $this->db->table('pengaturan')->insert([
                'key' => $key,
                'value_json' => json_encode($value),
                'updated_at' => $now,
            ]);
        }
    }
}
