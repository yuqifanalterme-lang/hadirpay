<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateKomponenGaji extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'kode'       => ['type' => 'VARCHAR', 'constraint' => 30],
            'nama'       => ['type' => 'VARCHAR', 'constraint' => 100],
            'tipe'       => ['type' => 'ENUM', 'constraint' => ['pendapatan', 'potongan']],
            'metode'     => ['type' => 'ENUM', 'constraint' => ['nominal_tetap', 'persen', 'per_hari', 'per_jam', 'per_menit']],
            'nilai'      => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => true],
            'keterangan' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'sistem'     => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'aktif'      => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('kode');
        $this->forge->createTable('komponen_gaji');
    }

    public function down()
    {
        $this->forge->dropTable('komponen_gaji', true);
    }
}