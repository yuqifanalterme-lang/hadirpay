<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class ExtendPayrollComponentSnapshots extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('komponen_gaji')) {
            $this->db->query(
                "ALTER TABLE komponen_gaji MODIFY COLUMN metode
                 ENUM('nominal_tetap', 'persen', 'per_hari', 'per_jam', 'per_menit', 'manual_periode') NOT NULL"
            );
        }

        if ($this->db->tableExists('karyawan_komponen')
            && ! $this->db->fieldExists('metode_override', 'karyawan_komponen')) {
            $this->forge->addColumn('karyawan_komponen', [
                'metode_override' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true, 'after' => 'nilai'],
            ]);
        }

        if ($this->db->tableExists('detail_penggajian')) {
            if (! $this->db->fieldExists('kode', 'detail_penggajian')) {
                $this->forge->addColumn('detail_penggajian', [
                    'kode' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true, 'after' => 'komponen_id'],
                ]);
            }
            if (! $this->db->fieldExists('sumber', 'detail_penggajian')) {
                $this->forge->addColumn('detail_penggajian', [
                    'sumber' => [
                        'type' => 'ENUM',
                        'constraint' => ['otomatis', 'manual'],
                        'default' => 'otomatis',
                        'after' => 'kode',
                    ],
                ]);
            }

            $rows = $this->db->table('detail_penggajian dp')
                ->select('dp.id, kg.kode')
                ->join('komponen_gaji kg', 'kg.id = dp.komponen_id')
                ->where('dp.kode', null)
                ->get()->getResultArray();
            foreach ($rows as $row) {
                $this->db->table('detail_penggajian')
                    ->where('id', (int) $row['id'])
                    ->update(['kode' => $row['kode']]);
            }
        }

        $this->seedMissingComponents();
    }

    public function down()
    {
        if ($this->db->tableExists('komponen_gaji')) {
            $this->db->table('komponen_gaji')
                ->where('metode', 'manual_periode')
                ->update(['metode' => 'nominal_tetap']);
            $this->db->query(
                "ALTER TABLE komponen_gaji MODIFY COLUMN metode
                 ENUM('nominal_tetap', 'persen', 'per_hari', 'per_jam', 'per_menit') NOT NULL"
            );
        }

        if ($this->db->tableExists('detail_penggajian')) {
            if ($this->db->fieldExists('sumber', 'detail_penggajian')) {
                $this->forge->dropColumn('detail_penggajian', 'sumber');
            }
            if ($this->db->fieldExists('kode', 'detail_penggajian')) {
                $this->forge->dropColumn('detail_penggajian', 'kode');
            }
        }
        if ($this->db->tableExists('karyawan_komponen')
            && $this->db->fieldExists('metode_override', 'karyawan_komponen')) {
            $this->forge->dropColumn('karyawan_komponen', 'metode_override');
        }
    }

    private function seedMissingComponents(): void
    {
        if (! $this->db->tableExists('komponen_gaji')) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $defaults = [
            ['TUN-TRANSPORT', 'Tunjangan Tetap', 'pendapatan', 'nominal_tetap', null],
            ['PEND-LEMBUR', 'Pendapatan Lembur', 'pendapatan', 'manual_periode', null],
            ['POT-ALPHA', 'Potongan Alpa', 'potongan', 'per_hari', null],
            ['POT-TELAT', 'Potongan Terlambat', 'potongan', 'nominal_tetap', 1000],
            ['BPJS', 'Potongan Iuran BPJS', 'potongan', 'persen', 3],
            ['PPH21', 'Potongan PPh 21', 'potongan', 'nominal_tetap', null],
            ['POT-LAIN', 'Potongan Lain', 'potongan', 'nominal_tetap', null],
        ];

        foreach ($defaults as [$kode, $nama, $tipe, $metode, $nilai]) {
            $exists = $this->db->table('komponen_gaji')->where('kode', $kode)->countAllResults();
            if ($exists > 0) {
                continue;
            }
            $this->db->table('komponen_gaji')->insert([
                'kode' => $kode,
                'nama' => $nama,
                'tipe' => $tipe,
                'metode' => $metode,
                'nilai' => $nilai,
                'keterangan' => null,
                'sistem' => 1,
                'aktif' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
