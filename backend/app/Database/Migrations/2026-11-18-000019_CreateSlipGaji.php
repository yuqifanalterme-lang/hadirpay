<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSlipGaji extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'             => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'penggajian_id'  => ['type' => 'INT', 'unsigned' => true],
            'nomor_slip'     => ['type' => 'VARCHAR', 'constraint' => 30],
            'tanggal_terbit' => ['type' => 'DATE'],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('penggajian_id');
        $this->forge->addUniqueKey('nomor_slip');
        $this->forge->addForeignKey('penggajian_id', 'penggajian', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('slip_gaji');
    }

    public function down()
    {
        $this->forge->dropTable('slip_gaji', true);
    }
}