<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateKaryawan extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'               => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'kode'             => ['type' => 'VARCHAR', 'constraint' => 20],
            'nama'             => ['type' => 'VARCHAR', 'constraint' => 150],
            'email'            => ['type' => 'VARCHAR', 'constraint' => 150],
            'no_hp'            => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'departemen_id'    => ['type' => 'INT', 'unsigned' => true],
            'jabatan_id'       => ['type' => 'INT', 'unsigned' => true],
            'tanggal_mulai'    => ['type' => 'DATE'],
            'jenis_penggajian' => ['type' => 'ENUM', 'constraint' => ['bulanan', 'harian'], 'default' => 'bulanan'],
            'gaji_pokok'       => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'tunjangan_tetap'  => ['type' => 'DECIMAL', 'constraint' => '15,2', 'default' => 0],
            'npwp'             => ['type' => 'VARCHAR', 'constraint' => 25, 'null' => true],
            'no_bpjs'          => ['type' => 'VARCHAR', 'constraint' => 25, 'null' => true],
            'status'           => ['type' => 'ENUM', 'constraint' => ['aktif', 'nonaktif'], 'default' => 'aktif'],
            'created_at'       => ['type' => 'DATETIME', 'null' => true],
            'updated_at'       => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('kode');
        $this->forge->addUniqueKey('email');
        $this->forge->addKey('status', false, false, 'idx_karyawan_status');
        $this->forge->addKey('nama', false, false, 'idx_karyawan_nama');
        $this->forge->addForeignKey('departemen_id', 'departemen', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('jabatan_id', 'jabatan', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('karyawan');
    }

    public function down()
    {
        $this->forge->dropTable('karyawan', true);
    }
}