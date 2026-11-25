<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AllowNullPayrollAuditActors extends Migration
{
    public function up()
    {
        $this->forge->modifyColumn('periode_gaji', [
            'dibuat_oleh' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
        ]);
        $this->forge->modifyColumn('periode_status_log', [
            'oleh' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
        ]);
    }

    public function down()
    {
        $hasAnonymousActors = $this->db->table('periode_gaji')->where('dibuat_oleh', null)->countAllResults() > 0
            || $this->db->table('periode_status_log')->where('oleh', null)->countAllResults() > 0;
        if ($hasAnonymousActors) {
            throw new \RuntimeException('Tidak dapat membatalkan migrasi: referensi aktor audit anonim masih digunakan.');
        }

        $this->forge->modifyColumn('periode_gaji', [
            'dibuat_oleh' => ['type' => 'INT', 'unsigned' => true, 'null' => false],
        ]);
        $this->forge->modifyColumn('periode_status_log', [
            'oleh' => ['type' => 'INT', 'unsigned' => true, 'null' => false],
        ]);
    }
}
