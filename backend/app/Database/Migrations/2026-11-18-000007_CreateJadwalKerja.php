<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateJadwalKerja extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'               => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'nama'             => ['type' => 'VARCHAR', 'constraint' => 100],
            'jam_masuk'        => ['type' => 'TIME'],
            'jam_pulang'       => ['type' => 'TIME'],
            'toleransi_menit'  => ['type' => 'SMALLINT', 'unsigned' => true, 'default' => 0],
            'hari_kerja'       => ['type' => 'VARCHAR', 'constraint' => 60],
            'is_default'       => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'created_at'       => ['type' => 'DATETIME', 'null' => true],
            'updated_at'       => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('jadwal_kerja');
    }

    public function down()
    {
        $this->forge->dropTable('jadwal_kerja', true);
    }
}