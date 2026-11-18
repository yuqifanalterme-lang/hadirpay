<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddJurnalFkToPeriodeGaji extends Migration
{
    public function up()
    {
        $this->forge->addColumn('periode_gaji', [
            'jurnal_pengakuan_id'  => ['type' => 'INT', 'unsigned' => true, 'null' => true, 'after' => 'dibuat_oleh'],
            'jurnal_pembayaran_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true, 'after' => 'jurnal_pengakuan_id'],
        ]);
        $this->db->query('ALTER TABLE periode_gaji ADD CONSTRAINT fk_periode_jurnal_pengakuan FOREIGN KEY (jurnal_pengakuan_id) REFERENCES jurnal(id) ON DELETE RESTRICT ON UPDATE RESTRICT');
        $this->db->query('ALTER TABLE periode_gaji ADD CONSTRAINT fk_periode_jurnal_pembayaran FOREIGN KEY (jurnal_pembayaran_id) REFERENCES jurnal(id) ON DELETE RESTRICT ON UPDATE RESTRICT');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE periode_gaji DROP FOREIGN KEY fk_periode_jurnal_pengakuan');
        $this->db->query('ALTER TABLE periode_gaji DROP FOREIGN KEY fk_periode_jurnal_pembayaran');
        $this->forge->dropColumn('periode_gaji', ['jurnal_pengakuan_id', 'jurnal_pembayaran_id']);
    }
}