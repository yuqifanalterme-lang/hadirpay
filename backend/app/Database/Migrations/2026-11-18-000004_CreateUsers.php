<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateUsers extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'            => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'karyawan_id'   => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'nama'          => ['type' => 'VARCHAR', 'constraint' => 150],
            'email'         => ['type' => 'VARCHAR', 'constraint' => 150],
            'password_hash' => ['type' => 'VARCHAR', 'constraint' => 255],
            'role'          => ['type' => 'ENUM', 'constraint' => ['admin_hrd', 'karyawan', 'keuangan', 'pemilik']],
            'aktif'         => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'last_login_at' => ['type' => 'DATETIME', 'null' => true],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
            'updated_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('karyawan_id');
        $this->forge->addUniqueKey('email');
        $this->forge->addForeignKey('karyawan_id', 'karyawan', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('users');
    }

    public function down()
    {
        $this->forge->dropTable('users', true);
    }
}