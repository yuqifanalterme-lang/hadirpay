<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePeriodeGaji extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'periode'         => ['type' => 'CHAR', 'constraint' => 7],
            'tanggal_mulai'   => ['type' => 'DATE'],
            'tanggal_selesai' => ['type' => 'DATE'],
            'tanggal_tutup'   => ['type' => 'DATE'],
            'hari_kerja'      => ['type' => 'TINYINT', 'unsigned' => true],
            'status'          => ['type' => 'ENUM', 'constraint' => ['draft', 'menunggu_validasi', 'disetujui', 'dibayar'], 'default' => 'draft'],
            'tanggal_bayar'   => ['type' => 'DATE', 'null' => true],
            'dibuat_oleh'     => ['type' => 'INT', 'unsigned' => true],
            'dihitung_pada'   => ['type' => 'DATETIME', 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('periode');
        $this->forge->addForeignKey('dibuat_oleh', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('periode_gaji');
    }

    public function down()
    {
        $this->forge->dropTable('periode_gaji', true);
    }
}