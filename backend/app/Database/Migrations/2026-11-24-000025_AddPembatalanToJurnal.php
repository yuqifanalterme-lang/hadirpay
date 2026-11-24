<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPembatalanToJurnal extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('status', 'jurnal')) {
            $this->forge->addColumn('jurnal', [
                'status'            => ['type' => 'ENUM', 'constraint' => ['aktif', 'dibatalkan'], 'default' => 'aktif', 'after' => 'total_kredit'],
                'dibatalkan_oleh'   => ['type' => 'INT', 'unsigned' => true, 'null' => true, 'after' => 'dibuat_oleh'],
                'dibatalkan_pada'   => ['type' => 'DATETIME', 'null' => true, 'after' => 'dibatalkan_oleh'],
                'alasan_pembatalan' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'dibatalkan_pada'],
            ]);
            $this->db->query(
                'ALTER TABLE jurnal
                 ADD CONSTRAINT fk_jurnal_dibatalkan_oleh
                 FOREIGN KEY (dibatalkan_oleh) REFERENCES users(id)
                 ON DELETE RESTRICT ON UPDATE RESTRICT'
            );
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('status', 'jurnal')) {
            $this->db->query('ALTER TABLE jurnal DROP FOREIGN KEY fk_jurnal_dibatalkan_oleh');
            $this->forge->dropColumn('jurnal', ['status', 'dibatalkan_oleh', 'dibatalkan_pada', 'alasan_pembatalan']);
        }
    }
}
