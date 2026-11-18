<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePeriodeStatusLog extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'periode_gaji_id' => ['type' => 'INT', 'unsigned' => true],
            'status'          => ['type' => 'ENUM', 'constraint' => ['draft', 'menunggu_validasi', 'disetujui', 'dibayar']],
            'oleh'            => ['type' => 'INT', 'unsigned' => true],
            'catatan'         => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at'      => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('periode_gaji_id', 'periode_gaji', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('oleh', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('periode_status_log');
    }

    public function down()
    {
        $this->forge->dropTable('periode_status_log', true);
    }
}