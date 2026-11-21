<?php

namespace App\Database\Seeds;

use App\Services\AccountingService;
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
        $uid = (int) $periode['dibuat_oleh'];
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
                $lembur = 0;
                if ($k['email'] === 'andi@hadirpay.test') {
                    if ($tanggal === '2026-10-05') {
                        $status = 'alpha';
                        $jamMasuk = null;
                        $jamPulang = null;
                    } elseif ($tanggal === '2026-10-09') {
                        $status = 'terlambat';
                        $jamMasuk = '08:20:00';
                        $menitTelat = 20;
                    } elseif ($tanggal === '2026-10-15') {
                        $jamPulang = '21:00:00';
                        $lembur = 240;
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
                    'lembur_menit' => $lembur,
                    'sumber' => 'sistem',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $andi = $db->table('karyawan')->where('email', 'andi@hadirpay.test')->get()->getRowArray();
        $potLain = $db->table('komponen_gaji')->where('kode', 'POT-LAIN')->get()->getRowArray();
        $bpjs = $db->table('komponen_gaji')->where('kode', 'BPJS')->get()->getRowArray();
        if ($andi && $potLain) {
            $this->db->table('karyawan_komponen')->ignore(true)->insert([
                'karyawan_id' => $andi['id'], 'komponen_id' => $potLain['id'], 'nilai' => 200000,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        if ($andi && $bpjs) {
            $this->db->table('karyawan_komponen')->ignore(true)->insert([
                'karyawan_id' => $andi['id'], 'komponen_id' => $bpjs['id'], 'nilai' => 1,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $hasil = (new PayrollService())->hitungPeriode($periode);
        $penggajian = $db->table('penggajian')->select('id')->where('periode_gaji_id', $periode['id'])->orderBy('id')->get()->getResultArray();
        $batch = [];
        foreach ($penggajian as $i => $row) {
            $batch[] = [
                'penggajian_id' => (int) $row['id'],
                'nomor_slip' => sprintf('SLP/2026/10/%04d', $i + 1),
                'tanggal_terbit' => '2026-10-31',
                'created_at' => $now,
            ];
        }
        if ($batch) $db->table('slip_gaji')->ignore(true)->insertBatch($batch);

        $jurnalPengakuan = AccountingService::jurnalPengakuan($db, $periode, $uid);
        $db->table('periode_gaji')->where('id', $periode['id'])->update([
            'status' => 'disetujui',
            'jurnal_pengakuan_id' => $jurnalPengakuan,
            'updated_at' => $now,
        ]);
        $jurnalPembayaran = AccountingService::jurnalPembayaran(
            $db,
            $db->table('periode_gaji')->where('id', $periode['id'])->get()->getRowArray(),
            $uid,
            (int) $db->table('akun')->where('kode', '1-1100')->get()->getRowArray()['id'],
            '2026-11-01'
        );
        $db->table('periode_gaji')->where('id', $periode['id'])->update([
            'status' => 'dibayar',
            'tanggal_bayar' => '2026-11-01',
            'jurnal_pembayaran_id' => $jurnalPembayaran,
            'updated_at' => $now,
        ]);
        echo 'Penggajian Oktober dibuat: ' . $hasil['jumlah_karyawan'] . ' karyawan.' . PHP_EOL;
    }
}
