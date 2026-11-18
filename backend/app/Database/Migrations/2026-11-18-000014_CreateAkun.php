<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAkun extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'kode'         => ['type' => 'VARCHAR', 'constraint' => 10],
            'nama'         => ['type' => 'VARCHAR', 'constraint' => 100],
            'kategori'     => ['type' => 'ENUM', 'constraint' => ['aset', 'kewajiban', 'ekuitas', 'pendapatan', 'beban']],
            'saldo_normal' => ['type' => 'ENUM', 'constraint' => ['debit', 'kredit']],
            'sistem'       => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'aktif'        => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('kode');
        $this->forge->createTable('akun');
    }

    public function down()
    {
        $this->forge->dropTable('akun', true);
    }
}