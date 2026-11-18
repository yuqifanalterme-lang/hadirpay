<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateKaryawanKomponen extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'karyawan_id' => ['type' => 'INT', 'unsigned' => true],
            'komponen_id' => ['type' => 'INT', 'unsigned' => true],
            'nilai'       => ['type' => 'DECIMAL', 'constraint' => '15,2'],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['karyawan_id', 'komponen_id'], 'uq_karyawan_komponen');
        $this->forge->addForeignKey('karyawan_id', 'karyawan', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('komponen_id', 'komponen_gaji', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('karyawan_komponen');
    }

    public function down()
    {
        $this->forge->dropTable('karyawan_komponen', true);
    }
}