<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddEmployeePayrollDeductions extends Migration
{
    public function up()
    {
        $now = date('Y-m-d H:i:s');
        $bpjs = $this->db->table('komponen_gaji')->where('kode', 'BPJS')->get()->getRowArray();
        if (! $bpjs) {
            $this->db->table('komponen_gaji')->insert([
                'kode' => 'BPJS',
                'nama' => 'Iuran BPJS',
                'tipe' => 'potongan',
                'metode' => 'persen',
                'nilai' => 3,
                'keterangan' => null,
                'sistem' => 1,
                'aktif' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $bpjs = $this->db->table('komponen_gaji')->where('kode', 'BPJS')->get()->getRowArray();
        }

        $overtime = $this->db->table('komponen_gaji')->where('kode', 'POT-LEMBUR')->get()->getRowArray();
        if (! $overtime) {
            $this->db->table('komponen_gaji')->insert([
                'kode' => 'POT-LEMBUR',
                'nama' => 'Pendapatan lembur per periode',
                'tipe' => 'pendapatan',
                'metode' => 'nominal_tetap',
                'nilai' => 0,
                'keterangan' => null,
                'sistem' => 1,
                'aktif' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $overtime = $this->db->table('komponen_gaji')->where('kode', 'POT-LEMBUR')->get()->getRowArray();
        }

        $accounts = [
            'kode' => '2-1500',
            'nama' => 'Utang Potongan Karyawan',
            'kategori' => 'kewajiban',
            'saldo_normal' => 'kredit',
            'sistem' => 1,
            'aktif' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        $existingAccount = $this->db->table('akun')->where('kode', $accounts['kode'])->get()->getRowArray();
        if ($existingAccount && (
            $existingAccount['nama'] !== $accounts['nama']
            || $existingAccount['kategori'] !== 'kewajiban'
            || $existingAccount['saldo_normal'] !== 'kredit'
        )) {
            throw new \RuntimeException('Kode akun 2-1500 sudah digunakan untuk akun yang berbeda.');
        }
        if (! $existingAccount) {
            $this->db->table('akun')->insert($accounts);
        }

        $defaultBpjs = (float) ($bpjs['nilai'] ?? 3);
        foreach ($this->db->table('karyawan')->select('id')->get()->getResultArray() as $employee) {
            $employeeId = (int) $employee['id'];
            foreach ([
                [(int) $bpjs['id'], $defaultBpjs],
                [(int) $overtime['id'], 0],
            ] as [$componentId, $value]) {
                $assigned = $this->db->table('karyawan_komponen')
                    ->where('karyawan_id', $employeeId)
                    ->where('komponen_id', $componentId)
                    ->countAllResults();
                if ($assigned === 0) {
                    $this->db->table('karyawan_komponen')->insert([
                        'karyawan_id' => $employeeId,
                        'komponen_id' => $componentId,
                        'nilai' => $value,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    public function down()
    {
        $overtime = $this->db->table('komponen_gaji')->where('kode', 'POT-LEMBUR')->get()->getRowArray();
        if ($overtime
            && $this->db->table('karyawan_komponen')->where('komponen_id', (int) $overtime['id'])->countAllResults() === 0
            && $this->db->table('detail_penggajian')->where('komponen_id', (int) $overtime['id'])->countAllResults() === 0) {
            $this->db->table('komponen_gaji')->where('id', (int) $overtime['id'])->delete();
        }

        $account = $this->db->table('akun')->where('kode', '2-1500')->get()->getRowArray();
        if ($account
            && $account['nama'] === 'Utang Potongan Karyawan'
            && $this->db->table('detail_jurnal')->where('akun_id', (int) $account['id'])->countAllResults() === 0) {
            $this->db->table('akun')->where('id', (int) $account['id'])->delete();
        }
    }
}
