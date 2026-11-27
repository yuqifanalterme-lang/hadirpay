<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class ClassifyOvertimeAsIncome extends Migration
{
    public function up()
    {
        if (! $this->db->tableExists('komponen_gaji')) {
            return;
        }

        $this->db->table('komponen_gaji')
            ->where('kode', 'POT-LEMBUR')
            ->update([
                'nama' => 'Pendapatan lembur per periode',
                'tipe' => 'pendapatan',
                'metode' => 'nominal_tetap',
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function down()
    {
        if (! $this->db->tableExists('komponen_gaji')) {
            return;
        }

        $this->db->table('komponen_gaji')
            ->where('kode', 'POT-LEMBUR')
            ->update([
                'nama' => 'Potongan lembur per periode',
                'tipe' => 'potongan',
                'metode' => 'nominal_tetap',
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }
}
