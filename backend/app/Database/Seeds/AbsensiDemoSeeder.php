<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

/**
 * DATA DEMO. Mengisi 20 hari kerja pertama November 2026 untuk karyawan aktif.
 * Baris manual dipertahankan, data demo yang sudah ada diperbarui tanpa lembur.
 *
 * Semua baris diberi sumber = 'sistem', jadi mudah dihapus:
 *   DELETE FROM absensi WHERE sumber = 'sistem' AND tanggal BETWEEN '2026-11-01' AND '2026-11-30';
 */
class AbsensiDemoSeeder extends Seeder
{
    public function run()
    {
        $db    = $this->db;
        $now   = date('Y-m-d H:i:s');
        $awal  = '2026-11-01';
        $akhir = '2026-11-30';

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
        for ($d = new \DateTime($awal); $d->format('Y-m-d') <= $akhir && count($tanggal) < 20; $d->modify('+1 day')) {
            $t = $d->format('Y-m-d');
            if (in_array($nama[(int) $d->format('N')], $hari, true) && ! in_array($t, $libur, true)) {
                $tanggal[] = $t;
            }
        }
        if (count($tanggal) !== 20) {
            throw new \RuntimeException('Jadwal kerja November 2026 tidak menyediakan 20 hari kerja untuk data demo.');
        }

        $lokasi = $db->table('lokasi_absensi')->where('aktif', 1)->orderBy('id')->get(1)->getRowArray();

        $ada = [];
        foreach ($db->table('absensi')->select('id, karyawan_id, tanggal, sumber')->where('tanggal >=', $awal)->where('tanggal <=', $akhir)->get()->getResultArray() as $a) {
            $ada[$a['karyawan_id'] . '|' . $a['tanggal']] = $a;
        }

        $dibuat = 0;
        $diperbarui = 0;
        $kodeDemo = array_map(static fn ($n) => sprintf('KRY-%04d', $n), range(1, 10));
        foreach ($db->table('karyawan')->whereIn('kode', $kodeDemo)->where('status', 'aktif')->orderBy('id')->get()->getResultArray() as $k) {
            foreach ($tanggal as $t) {
                $existing = $ada[$k['id'] . '|' . $t] ?? null;
                if ($t < $k['tanggal_mulai'] || ($existing && $existing['sumber'] !== 'sistem')) {
                    continue;
                }

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

                if ($n < 3) {
                    $row['status'] = 'izin';
                } elseif ($n < 5) {
                    $row['status'] = 'sakit';
                } elseif ($n < 7) {
                    $row['status'] = 'alpha';
                } else {
                    $masukMenit = 7 * 60 + 45 + ($n % 14);
                    $pulangMenit = 17 * 60;
                    $row['dalam_radius'] = 1;

                    if ($n >= 80 && $n <= 89) {
                        $telat = 5 + ($n - 80) * 4;
                        $masukMenit = 8 * 60 + $telat;
                        $row['status'] = 'terlambat';
                        $row['menit_terlambat'] = $telat;
                    }

                    $row['jam_masuk']    = sprintf('%02d:%02d:00', intdiv($masukMenit, 60), $masukMenit % 60);
                    $row['jam_pulang']   = sprintf('%02d:%02d:00', intdiv($pulangMenit, 60), $pulangMenit % 60);
                    $row['durasi_menit'] = $pulangMenit - $masukMenit;
                }

                if ($existing) {
                    $db->table('absensi')->where('id', $existing['id'])->update($row);
                    $diperbarui++;
                } else {
                    $db->table('absensi')->insert($row);
                    $dibuat++;
                }
            }
        }

        echo "{$dibuat} baris absensi demo dibuat dan {$diperbarui} diperbarui untuk 20 hari kerja November 2026 tanpa lembur.\n";
    }
}
