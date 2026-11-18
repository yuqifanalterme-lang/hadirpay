<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateLokasiAbsensi extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'nama'         => ['type' => 'VARCHAR', 'constraint' => 100],
            'alamat'       => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'latitude'     => ['type' => 'DECIMAL', 'constraint' => '10,7'],
            'longitude'    => ['type' => 'DECIMAL', 'constraint' => '10,7'],
            'radius_meter' => ['type' => 'INT', 'unsigned' => true, 'default' => 100],
            'wajib_lokasi' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'aktif'        => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('lokasi_absensi');
    }

    public function down()
    {
        $this->forge->dropTable('lokasi_absensi', true);
    }
}