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
        $this->db->table('detail_penggajian')
            ->where('kode', 'POT-LEMBUR')
            ->update([
                'nama' => 'Pendapatan lembur per periode',
                'tipe' => 'pendapatan',
            ]);
        $this->db->table('detail_penggajian')
            ->where('kode', 'PEND-LEMBUR')
            ->update(['tipe' => 'pendapatan']);

        foreach ($this->db->table('penggajian')->get()->getResultArray() as $row) {
            $details = $this->db->table('detail_penggajian')
                ->select('tipe, jumlah')
                ->where('penggajian_id', (int) $row['id'])
                ->get()->getResultArray();
            $income = 0.0;
            $deduction = 0.0;
            foreach ($details as $detail) {
                if ($detail['tipe'] === 'pendapatan') {
                    $income += (float) $detail['jumlah'];
                } else {
                    $deduction += (float) $detail['jumlah'];
                }
            }
            $this->db->table('penggajian')->where('id', (int) $row['id'])->update([
                'tunjangan' => round(max(0, $income - (float) $row['gaji_pokok']), 2),
                'total_pendapatan' => round($income, 2),
                'total_potongan' => round($deduction, 2),
                'gaji_bersih' => round($income - $deduction, 2),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }
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
