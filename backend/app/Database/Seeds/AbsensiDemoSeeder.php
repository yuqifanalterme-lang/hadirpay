<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

/**
 * DATA DEMO. Mengisi absensi semua karyawan aktif dari tanggal 1 bulan berjalan sampai KEMARIN,
 * hanya untuk hari kerja (jadwal default, tanpa hari libur). Baris yang sudah ada tidak ditimpa.
 *
 * Semua baris diberi sumber = 'sistem', jadi mudah dihapus:
 *   DELETE FROM absensi WHERE sumber = 'sistem';
 */
class AbsensiDemoSeeder extends Seeder
{
    public function run()
    {
        $db    = $this->db;
        $now   = date('Y-m-d H:i:s');
        $awal  = date('Y-m-01');
        $akhir = date('Y-m-d', strtotime('-1 day'));

        if ($akhir < $awal) {
            echo "Hari ini tanggal 1, belum ada hari yang bisa diisi.\n";
            return;
        }

        $jadwal = $db->table('jadwal_kerja')->where('is_default', 1)->get()->getRowArray();
        $hari   = $jadwal
            ? array_filter(array_map('trim', explode(',', strtolower($jadwal['hari_kerja']))))
            : ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];

        $libur = array_column(
            $db->table('hari_libur')->select('tanggal')->where('tanggal >=', $awal)->where('tanggal <=', $akhir)->get()->getResultArray(),
            'tanggal'
        );

        $nama     = [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu', 7 => 'minggu'];
        $tanggal  = [];
        for ($d = new \DateTime($awal); $d->format('Y-m-d') <= $akhir; $d->modify('+1 day')) {
            $t = $d->format('Y-m-d');
            if (in_array($nama[(int) $d->format('N')], $hari, true) && ! in_array($t, $libur, true)) {
                $tanggal[] = $t;
            }
        }

        $lokasi = $db->table('lokasi_absensi')->where('aktif', 1)->orderBy('id')->get(1)->getRowArray();

        $ada = [];
        foreach ($db->table('absensi')->select('karyawan_id, tanggal')->where('tanggal >=', $awal)->where('tanggal <=', $akhir)->get()->getResultArray() as $a) {
            $ada[$a['karyawan_id'] . '|' . $a['tanggal']] = true;
        }

        $baris = [];
        foreach ($db->table('karyawan')->where('status', 'aktif')->orderBy('id')->get()->getResultArray() as $k) {
            foreach ($tanggal as $t) {
                if ($t < $k['tanggal_mulai'] || isset($ada[$k['id'] . '|' . $t])) {
                    continue;
                }

                // angka 0-99 yang tetap untuk pasangan karyawan + tanggal (hasil selalu sama kalau diulang)
                $n = crc32($k['id'] . '|' . $t) % 100;

                $row = [
                    'karyawan_id'       => (int) $k['id'],
                    'tanggal'           => $t,
                    'jam_masuk'         => null,
                    'jam_pulang'        => null,
                    'status'            => 'hadir',
                    'menit_terlambat'   => 0,
                    'durasi_menit'      => null,
                    'lembur_menit'      => 0,
                    'dalam_radius'      => null,
                    'lokasi_absensi_id' => $lokasi['id'] ?? null,
                    'sumber'            => 'sistem',
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ];

                if ($n >= 90 && $n <= 92) {
                    $row['status'] = 'izin';
                } elseif ($n >= 93 && $n <= 94) {
                    $row['status'] = 'sakit';
                } elseif ($n >= 95 && $n <= 96) {
                    $row['status'] = 'alpha';
                } else {
                    $masukMenit = 7 * 60 + 45 + ($n % 14);              // 07:45 - 07:58
                    $pulangMenit = 17 * 60;                              // 17:00 tepat, tanpa lembur
                    $row['dalam_radius'] = 1;

                    if ($n >= 80 && $n <= 89) {                          // terlambat 5 - 44 menit
                        $telat = 5 + ($n - 80) * 4;
                        $masukMenit = 8 * 60 + $telat;
                        $row['status'] = 'terlambat';
                        $row['menit_terlambat'] = $telat;
                    } elseif ($n >= 97) {                                // lembur 60 - 120 menit
                        $lembur = 60 + ($n - 97) * 30;
                        $pulangMenit = 17 * 60 + $lembur;
                        $row['lembur_menit'] = $lembur;
                    }

                    $row['jam_masuk']    = sprintf('%02d:%02d:00', intdiv($masukMenit, 60), $masukMenit % 60);
                    $row['jam_pulang']   = sprintf('%02d:%02d:00', intdiv($pulangMenit, 60), $pulangMenit % 60);
                    $row['durasi_menit'] = $pulangMenit - $masukMenit;
                }

                $baris[] = $row;
            }
        }

        foreach (array_chunk($baris, 400) as $paket) {
            $db->table('absensi')->insertBatch($paket);
        }

        echo count($baris) . " baris absensi demo dibuat ({$awal} s/d {$akhir}).\n";
    }
}
