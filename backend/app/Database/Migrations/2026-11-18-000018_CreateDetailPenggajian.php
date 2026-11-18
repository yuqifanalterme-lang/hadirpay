<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDetailPenggajian extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'penggajian_id'=> ['type' => 'INT', 'unsigned' => true],
            'komponen_id'  => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'nama'         => ['type' => 'VARCHAR', 'constraint' => 100],
            'tipe'         => ['type' => 'ENUM', 'constraint' => ['pendapatan', 'potongan']],
            'keterangan'   => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
            'jumlah'       => ['type' => 'DECIMAL', 'constraint' => '15,2'],
            'urutan'       => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 0],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('penggajian_id', 'penggajian', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('komponen_id', 'komponen_gaji', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('detail_penggajian');
    }

    public function down()
    {
        $this->forge->dropTable('detail_penggajian', true);
    }
}