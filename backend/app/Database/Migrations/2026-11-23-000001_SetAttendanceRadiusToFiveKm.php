<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class SetAttendanceRadiusToFiveKm extends Migration
{
    public function up()
    {
        $this->db->table('lokasi_absensi')
            ->where('nama', 'Sekolah Vokasi IPB (Kampus Cilibende)')
            ->where('radius_meter', 300)
            ->update([
                'radius_meter' => 5000,
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);
    }

    public function down()
    {
        $this->db->table('lokasi_absensi')
            ->where('nama', 'Sekolah Vokasi IPB (Kampus Cilibende)')
            ->where('radius_meter', 5000)
            ->update([
                'radius_meter' => 300,
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);
    }
}
