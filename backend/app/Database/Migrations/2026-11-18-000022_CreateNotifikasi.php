<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateNotifikasi extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'     => ['type' => 'INT', 'unsigned' => true],
            'judul'       => ['type' => 'VARCHAR', 'constraint' => 150],
            'pesan'       => ['type' => 'VARCHAR', 'constraint' => 255],
            'tipe'        => ['type' => 'ENUM', 'constraint' => ['pengajuan', 'penggajian', 'slip', 'sistem']],
            'tautan'      => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'dibaca_pada' => ['type' => 'DATETIME', 'null' => true],
            'created_at'  => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['user_id', 'dibaca_pada', 'created_at'], false, false, 'idx_notif_user');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('notifikasi');
    }

    public function down()
    {
        $this->forge->dropTable('notifikasi', true);
    }
}