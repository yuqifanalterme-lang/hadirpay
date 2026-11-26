<?php

namespace App\Database\Seeds;

use App\Services\PayrollService;
use CodeIgniter\Database\Seeder;

class PenggajianOktoberSeeder extends Seeder
{
    public function run()
    {
        $db = $this->db;
        $periode = $db->table('periode_gaji')->where('periode', '2026-10')->get()->getRowArray();
        if (! $periode) {
            echo "Periode Oktober belum tersedia.\n";
            return;
        }
        $existingSlip = $db->table('slip_gaji s')
            ->join('penggajian g', 'g.id = s.penggajian_id')
            ->where('g.periode_gaji_id', (int) $periode['id'])
            ->countAllResults();
        if ($existingSlip > 0) {
            echo "Penggajian Oktober sudah ada; seeder dilewati.\n";
            return;
        }
        $now = date('Y-m-d H:i:s');

        $hariKerja = (new PayrollService())->hariKerja('2026-10-01', '2026-10-31');
        foreach ($db->table('karyawan')->where('status', 'aktif')->get()->getResultArray() as $k) {
            foreach ($hariKerja as $tanggal) {
                if ($tanggal < $k['tanggal_mulai']) continue;
                $ada = $db->table('absensi')->where('karyawan_id', $k['id'])->where('tanggal', $tanggal)->countAllResults();
                if ($ada > 0) continue;

                $status = 'hadir';
                $jamMasuk = '07:52:00';
                $jamPulang = '17:00:00';
                $menitTelat = 0;
                if ($k['email'] === 'andi@hadirpay.test') {
                    if ($tanggal === '2026-10-05') {
                        $status = 'alpha';
                        $jamMasuk = null;
                        $jamPulang = null;
                    } elseif ($tanggal === '2026-10-09') {
                        $status = 'terlambat';
                        $jamMasuk = '08:20:00';
                        $menitTelat = 20;
                    }
                }
                $durasi = $jamMasuk && $jamPulang
                    ? max(0, intdiv(strtotime($tanggal . ' ' . $jamPulang) - strtotime($tanggal . ' ' . $jamMasuk), 60))
                    : null;
                $db->table('absensi')->insert([
                    'karyawan_id' => $k['id'],
                    'tanggal' => $tanggal,
                    'jam_masuk' => $jamMasuk,
                    'jam_pulang' => $jamPulang,
                    'status' => $status,
                    'menit_terlambat' => $menitTelat,
                    'durasi_menit' => $durasi,
                    'lembur_menit' => 0,
                    'sumber' => 'sistem',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $andi = $db->table('karyawan')->where('email', 'andi@hadirpay.test')->get()->getRowArray();
        $potLain = $db->table('komponen_gaji')->where('kode', 'POT-LAIN')->get()->getRowArray();
        if ($andi && $potLain) {
            $this->db->table('karyawan_komponen')->ignore(true)->insert([
                'karyawan_id' => $andi['id'], 'komponen_id' => $potLain['id'], 'nilai' => 200000,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        $hasil = (new PayrollService())->hitungPeriode($periode);
        $db->table('periode_gaji')->where('id', $periode['id'])->update([
            'status' => 'draft',
            'tanggal_bayar' => null,
            'jurnal_pengakuan_id' => null,
            'jurnal_pembayaran_id' => null,
            'updated_at' => $now,
        ]);
        echo 'Penggajian Oktober dihitung untuk ' . $hasil['jumlah_karyawan'] . ' karyawan; menunggu persetujuan dan pembayaran.' . PHP_EOL;
    }
}
