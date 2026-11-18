<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateJurnal extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'nomor_bukti'     => ['type' => 'VARCHAR', 'constraint' => 30],
            'tanggal'         => ['type' => 'DATE'],
            'keterangan'      => ['type' => 'VARCHAR', 'constraint' => 255],
            'sumber'          => ['type' => 'ENUM', 'constraint' => ['otomatis', 'manual']],
            'jenis'           => ['type' => 'ENUM', 'constraint' => ['pengakuan_gaji', 'pembayaran_gaji', 'manual']],
            'periode_gaji_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'total_debit'     => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'total_kredit'    => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'dibuat_oleh'     => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('nomor_bukti');
        $this->forge->addKey('tanggal', false, false, 'idx_jurnal_tanggal');
        $this->forge->addKey(['periode_gaji_id', 'jenis'], false, false, 'idx_jurnal_periode');
        $this->forge->addForeignKey('periode_gaji_id', 'periode_gaji', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('dibuat_oleh', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('jurnal');
    }

    public function down()
    {
        $this->forge->dropTable('jurnal', true);
    }
}