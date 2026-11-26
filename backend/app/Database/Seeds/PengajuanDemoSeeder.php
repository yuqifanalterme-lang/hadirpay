<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class PengajuanDemoSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');
        $karyawan = array_column($this->db->table('karyawan')->select('id,nama')->get()->getResultArray(), 'id', 'nama');
        $rina = $this->db->table('users')->where('email', 'rina@hadirpay.test')->get()->getRowArray();
        $rows = [
            ['Budi Santoso', 'cuti', '2026-11-24', '2026-11-26', 3.0, 'Acara keluarga', null, null, 'menunggu'],
            ['Siti Rahmawati', 'sakit', '2026-11-17', '2026-11-17', 1.0, 'Demam, surat dokter menyusul', null, null, 'menunggu'],
            ['Andi Wijaya', 'cuti', '2026-11-24', '2026-11-24', 1.0, 'Keperluan keluarga', null, (int) $rina['id'], 'disetujui'],
            ['Rudi Hartono', 'koreksi_absensi', '2026-11-10', '2026-11-10', 1.0, 'Lupa absen', json_encode(['jam_masuk_benar' => '07:55', 'jam_pulang_benar' => '17:00']), (int) $rina['id'], 'disetujui'],
            ['Agus Saputra', 'izin', '2026-11-05', '2026-11-05', 1.0, 'Keperluan pribadi', null, (int) $rina['id'], 'ditolak'],
        ];
        foreach ($rows as [$nama, $jenis, $mulai, $selesai, $hari, $alasan, $dataJson, $proses, $status]) {
            $kid = (int) ($karyawan[$nama] ?? 0);
            if (! $kid) continue;
            $exists = $this->db->table('pengajuan_izin')
                ->where('karyawan_id', $kid)->where('jenis', $jenis)
                ->where('tanggal_mulai', $mulai)->countAllResults();
            if ($exists > 0) continue;
            $this->db->table('pengajuan_izin')->insert([
                'karyawan_id' => $kid,
                'jenis' => $jenis,
                'tanggal_mulai' => $mulai,
                'tanggal_selesai' => $selesai,
                'jumlah_hari' => $hari,
                'alasan' => $alasan,
                'lampiran_path' => null,
                'data_json' => $dataJson,
                'status' => $status,
                'diproses_oleh' => $status === 'menunggu' ? null : $proses,
                'diproses_pada' => $status === 'menunggu' ? null : $now,
                'alasan_penolakan' => $status === 'ditolak' ? 'Dokumen pendukung tidak lengkap' : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
