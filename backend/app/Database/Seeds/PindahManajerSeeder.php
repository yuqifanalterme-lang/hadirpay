<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class PindahManajerSeeder extends Seeder
{
    public function run()
    {
        $db   = $this->db;
        $lama = $db->table('jabatan')->where('nama', 'Manajer')->get()->getRowArray();

        if (! $lama) {
            echo "Jabatan 'Manajer' lama tidak ada, tidak ada yang perlu dipindah.\n";
            return;
        }

        $karyawan = $db->table('karyawan')
            ->select('karyawan.id, karyawan.nama, departemen.nama AS departemen_nama')
            ->join('departemen', 'departemen.id = karyawan.departemen_id')
            ->where('karyawan.jabatan_id', $lama['id'])
            ->get()->getResultArray();

        $gagal = 0;
        foreach ($karyawan as $k) {
            $baru = $db->table('jabatan')->where('nama', 'Manajer ' . $k['departemen_nama'])->get()->getRowArray();

            if (! $baru) {
                echo "Lewati {$k['nama']}: jabatan 'Manajer {$k['departemen_nama']}' belum ada.\n";
                $gagal++;
                continue;
            }

            $db->table('karyawan')->where('id', $k['id'])->update([
                'jabatan_id' => $baru['id'],
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
            echo "{$k['nama']} -> {$baru['nama']}\n";
        }

        // Hapus jabatan lama hanya kalau sudah tidak dipakai siapa pun
        $sisa = $db->table('karyawan')->where('jabatan_id', $lama['id'])->countAllResults();
        if ($sisa === 0) {
            $db->table('jabatan')->where('id', $lama['id'])->delete();
            echo "Jabatan 'Manajer' lama dihapus.\n";
        } else {
            echo "Jabatan 'Manajer' lama dipertahankan, masih dipakai {$sisa} karyawan.\n";
        }
    }
}