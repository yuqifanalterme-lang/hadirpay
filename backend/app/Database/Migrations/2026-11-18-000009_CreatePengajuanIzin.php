<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePengajuanIzin extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'               => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'karyawan_id'      => ['type' => 'INT', 'unsigned' => true],
            'jenis'            => ['type' => 'ENUM', 'constraint' => ['izin', 'sakit', 'cuti', 'koreksi_absensi', 'lembur']],
            'tanggal_mulai'    => ['type' => 'DATE'],
            'tanggal_selesai'  => ['type' => 'DATE'],
            'jumlah_hari'      => ['type' => 'DECIMAL', 'constraint' => '4,1', 'default' => 0],
            'alasan'           => ['type' => 'TEXT', 'null' => true],
            'lampiran_path'    => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'data_json'        => ['type' => 'JSON', 'null' => true],
            'status'           => ['type' => 'ENUM', 'constraint' => ['menunggu', 'disetujui', 'ditolak', 'dibatalkan'], 'default' => 'menunggu'],
            'diproses_oleh'    => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'diproses_pada'    => ['type' => 'DATETIME', 'null' => true],
            'alasan_penolakan' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at'       => ['type' => 'DATETIME', 'null' => true],
            'updated_at'       => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['status', 'jenis'], false, false, 'idx_pengajuan_status');
        $this->forge->addKey(['karyawan_id', 'tanggal_mulai'], false, false, 'idx_pengajuan_karyawan');
        $this->forge->addForeignKey('karyawan_id', 'karyawan', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('diproses_oleh', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('pengajuan_izin');
    }

    public function down()
    {
        $this->forge->dropTable('pengajuan_izin', true);
    }
}