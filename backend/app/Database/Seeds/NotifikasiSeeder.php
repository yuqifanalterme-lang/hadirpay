<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class NotifikasiSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $users = array_column($this->db->table('users')->select('id,email')->get()->getResultArray(), 'id', 'email');
        $rows = [
            [$users['rina@hadirpay.test'] ?? null, 'Pengajuan cuti baru', 'Budi Santoso mengajukan cuti 24-26 Nov 2026', 'pengajuan', '/app/pengajuan'],
            [$users['rina@hadirpay.test'] ?? null, 'Pengajuan sakit baru', 'Siti Rahmawati mengajukan sakit', 'pengajuan', '/app/pengajuan'],
            [$users['andi@hadirpay.test'] ?? null, 'Slip gaji tersedia', 'Slip gaji Oktober 2026 sudah tersedia', 'slip', '/app/slip-gaji'],
        ];
        foreach ($rows as [$uid, $judul, $pesan, $tipe, $tautan]) {
            if (! $uid) continue;
            $exists = $this->db->table('notifikasi')->where('user_id', $uid)->where('judul', $judul)->countAllResults();
            if ($exists > 0) continue;
            $this->db->table('notifikasi')->insert([
                'user_id' => $uid,
                'judul' => $judul,
                'pesan' => $pesan,
                'tipe' => $tipe,
                'tautan' => $tautan,
                'dibaca_pada' => null,
                'created_at' => $now,
            ]);
        }
    }
}
