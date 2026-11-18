<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePengaturan extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'key'        => ['type' => 'VARCHAR', 'constraint' => 80],
            'value_json' => ['type' => 'JSON'],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('key', true);
        $this->forge->createTable('pengaturan');
    }

    public function down()
    {
        $this->forge->dropTable('pengaturan', true);
    }
}