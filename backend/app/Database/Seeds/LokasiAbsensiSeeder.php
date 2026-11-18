<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class LokasiAbsensiSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $this->db->table('lokasi_absensi')->insert([
            'nama'         => 'Sekolah Vokasi IPB (Kampus Cilibende)',
            'alamat'       => 'Jl. Kumbang No. 14, Babakan, Bogor Tengah, Kota Bogor',
            'latitude'     => -6.5877800,
            'longitude'    => 106.8058300,
            'radius_meter' => 300,
            'wajib_lokasi' => 0,
            'aktif'        => 1,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);
    }
}