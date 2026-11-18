<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAbsensi extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'                 => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'karyawan_id'        => ['type' => 'INT', 'unsigned' => true],
            'tanggal'            => ['type' => 'DATE'],
            'jam_masuk'          => ['type' => 'TIME', 'null' => true],
            'jam_pulang'         => ['type' => 'TIME', 'null' => true],
            'status'             => ['type' => 'ENUM', 'constraint' => ['hadir', 'terlambat', 'izin', 'sakit', 'cuti', 'alpha', 'dinas_luar']],
            'menit_terlambat'    => ['type' => 'SMALLINT', 'unsigned' => true, 'default' => 0],
            'durasi_menit'       => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => true],
            'lembur_menit'       => ['type' => 'SMALLINT', 'unsigned' => true, 'default' => 0],
            'lokasi_masuk_lat'   => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'lokasi_masuk_lng'   => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'lokasi_pulang_lat'  => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'lokasi_pulang_lng'  => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'dalam_radius'       => ['type' => 'TINYINT', 'constraint' => 1, 'null' => true],
            'lokasi_absensi_id'  => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'sumber'             => ['type' => 'ENUM', 'constraint' => ['web', 'koreksi', 'sistem'], 'default' => 'web'],
            'pengajuan_id'       => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'created_at'         => ['type' => 'DATETIME', 'null' => true],
            'updated_at'         => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['karyawan_id', 'tanggal'], 'uq_absensi_karyawan_tanggal');
        $this->forge->addKey('tanggal', false, false, 'idx_absensi_tanggal');
        $this->forge->addKey(['tanggal', 'status'], false, false, 'idx_absensi_status');
        $this->forge->addForeignKey('karyawan_id', 'karyawan', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('lokasi_absensi_id', 'lokasi_absensi', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('pengajuan_id', 'pengajuan_izin', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('absensi');
    }

    public function down()
    {
        $this->forge->dropTable('absensi', true);
    }
}