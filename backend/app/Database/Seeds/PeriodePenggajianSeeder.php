<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class PeriodePenggajianSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $dibuat = $this->db->table('users')->where('email', 'rina@hadirpay.test')->get()->getRowArray();
        $uid = (int) ($dibuat['id'] ?? 1);
        $rows = [
            ['2026-10', '2026-10-01', '2026-10-31', '2026-10-25', 22, 'draft', null],
            ['2026-11', '2026-11-01', '2026-11-30', '2026-11-25', 22, 'draft', null],
        ];
        foreach ($rows as [$periode, $mulai, $selesai, $tutup, $hariKerja, $status, $bayar]) {
            if ($this->db->table('periode_gaji')->where('periode', $periode)->countAllResults() > 0) continue;
            $this->db->table('periode_gaji')->insert([
                'periode' => $periode,
                'tanggal_mulai' => $mulai,
                'tanggal_selesai' => $selesai,
                'tanggal_tutup' => $tutup,
                'hari_kerja' => $hariKerja,
                'status' => $status,
                'tanggal_bayar' => $bayar,
                'dibuat_oleh' => $uid,
                'dihitung_pada' => $status === 'dibayar' ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $pid = (int) $this->db->insertID();
            $this->db->table('periode_status_log')->insert([
                'periode_gaji_id' => $pid,
                'status' => $status,
                'oleh' => $uid,
                'catatan' => 'Data periode demo',
                'created_at' => $now,
            ]);
        }
    }
}
