<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDetailJurnal extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'        => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'jurnal_id' => ['type' => 'INT', 'unsigned' => true],
            'akun_id'   => ['type' => 'INT', 'unsigned' => true],
            'debit'     => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'kredit'    => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'urutan'    => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 0],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('akun_id', false, false, 'idx_dj_akun');
        $this->forge->addForeignKey('jurnal_id', 'jurnal', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('akun_id', 'akun', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('detail_jurnal');
    }

    public function down()
    {
        $this->forge->dropTable('detail_jurnal', true);
    }
}