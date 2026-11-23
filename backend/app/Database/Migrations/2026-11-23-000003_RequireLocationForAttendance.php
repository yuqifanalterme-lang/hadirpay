<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RequireLocationForAttendance extends Migration
{
    public function up()
    {
        $this->db->table('lokasi_absensi')
            ->where('nama', 'Sekolah Vokasi IPB (Kampus Cilibende)')
            ->update([
                'radius_meter' => 300,
                'wajib_lokasi' => 1,
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);
    }

    public function down()
    {
        $this->db->table('lokasi_absensi')
            ->where('nama', 'Sekolah Vokasi IPB (Kampus Cilibende)')
            ->update([
                'wajib_lokasi' => 0,
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);
    }
}
