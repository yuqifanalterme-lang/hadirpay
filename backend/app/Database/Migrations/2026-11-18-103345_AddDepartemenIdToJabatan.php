<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDepartemenIdToJabatan extends Migration
{
    public function up()
    {
        $this->forge->addColumn('jabatan', [
            'departemen_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true, 'after' => 'nama'],
        ]);

        $this->db->query(
            'ALTER TABLE jabatan
             ADD CONSTRAINT fk_jabatan_departemen
             FOREIGN KEY (departemen_id) REFERENCES departemen(id)
             ON DELETE RESTRICT ON UPDATE RESTRICT'
        );
    }

    public function down()
    {
        $this->db->query('ALTER TABLE jabatan DROP FOREIGN KEY fk_jabatan_departemen');
        $this->forge->dropColumn('jabatan', 'departemen_id');
    }
}