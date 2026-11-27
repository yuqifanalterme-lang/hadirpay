<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPayrollExpenseAccounts extends Migration
{
    public function up()
    {
        if (! $this->db->tableExists('akun')) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        foreach ([
            ['5-1200', 'Beban Tunjangan', 'beban', 'debit'],
            ['5-1300', 'Beban Upah Lembur', 'beban', 'debit'],
        ] as [$kode, $nama, $kategori, $saldoNormal]) {
            $existing = $this->db->table('akun')->where('kode', $kode)->get()->getRowArray();
            if ($existing) {
                $this->db->table('akun')->where('id', (int) $existing['id'])->update([
                    'nama' => $nama,
                    'kategori' => $kategori,
                    'saldo_normal' => $saldoNormal,
                    'aktif' => 1,
                    'updated_at' => $now,
                ]);
                continue;
            }
            $this->db->table('akun')->insert([
                'kode' => $kode,
                'nama' => $nama,
                'kategori' => $kategori,
                'saldo_normal' => $saldoNormal,
                'sistem' => 1,
                'aktif' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down()
    {
        if (! $this->db->tableExists('akun')) {
            return;
        }
        $this->db->table('akun')->whereIn('kode', ['5-1200', '5-1300'])->delete();
    }
}
