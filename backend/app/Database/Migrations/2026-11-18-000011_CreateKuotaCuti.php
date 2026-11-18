<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateKuotaCuti extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'karyawan_id' => ['type' => 'INT', 'unsigned' => true],
            'tahun'       => ['type' => 'SMALLINT', 'unsigned' => true],
            'total'       => ['type' => 'DECIMAL', 'constraint' => '4,1', 'default' => 12],
            'terpakai'    => ['type' => 'DECIMAL', 'constraint' => '4,1', 'default' => 0],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['karyawan_id', 'tahun'], 'uq_kuota_karyawan_tahun');
        $this->forge->addForeignKey('karyawan_id', 'karyawan', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('kuota_cuti');
    }

    public function down()
    {
        $this->forge->dropTable('kuota_cuti', true);
    }
}