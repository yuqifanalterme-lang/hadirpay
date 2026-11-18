<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePenggajian extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'periode_gaji_id' => ['type' => 'INT', 'unsigned' => true],
            'karyawan_id'     => ['type' => 'INT', 'unsigned' => true],
            'gaji_pokok'      => ['type' => 'DECIMAL', 'constraint' => '15,2'],
            'tunjangan'       => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'upah_lembur'     => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'total_pendapatan'=> ['type' => 'DECIMAL', 'constraint' => '15,2'],
            'total_potongan'  => ['type' => 'DECIMAL', 'constraint' => '15,2'],
            'gaji_bersih'     => ['type' => 'DECIMAL', 'constraint' => '15,2'],
            'tarif_harian'    => ['type' => 'DECIMAL', 'constraint' => '15,2'],
            'rekap_json'      => ['type' => 'JSON'],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['periode_gaji_id', 'karyawan_id'], 'uq_penggajian_periode_karyawan');
        $this->forge->addForeignKey('periode_gaji_id', 'periode_gaji', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('karyawan_id', 'karyawan', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('penggajian');
    }

    public function down()
    {
        $this->forge->dropTable('penggajian', true);
    }
}