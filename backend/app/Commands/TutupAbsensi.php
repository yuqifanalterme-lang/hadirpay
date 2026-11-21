<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class TutupAbsensi extends BaseCommand
{
    protected $group       = 'Hadirpay';
    protected $name        = 'absensi:tutup-hari';
    protected $description = 'Menandai karyawan aktif yang belum absen pada hari kerja sebagai alpha.';

    public function run(array $params)
    {
        date_default_timezone_set('Asia/Jakarta');
        $tanggal = $params[0] ?? date('Y-m-d');
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal) || ! checkdate((int) substr($tanggal, 5, 2), (int) substr($tanggal, 8, 2), (int) substr($tanggal, 0, 4))) {
            CLI::error('Tanggal harus berformat YYYY-MM-DD.');
            return;
        }

        $db = db_connect();
        $jadwal = $db->table('jadwal_kerja')->where('is_default', 1)->get()->getRowArray();
        $hariKerja = $jadwal ? array_map('trim', explode(',', strtolower($jadwal['hari_kerja']))) : ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
        $namaHari = [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu', 7 => 'minggu'];
        $hari = $namaHari[(int) date('N', strtotime($tanggal))];

        if (! in_array($hari, $hariKerja, true) || $db->table('hari_libur')->where('tanggal', $tanggal)->countAllResults() > 0) {
            CLI::write("{$tanggal} bukan hari kerja.");
            return;
        }

        $now = date('Y-m-d H:i:s');
        $karyawan = $db->table('karyawan')->where('status', 'aktif')->where('tanggal_mulai <=', $tanggal)->get()->getResultArray();
        $inserted = 0;

        $db->transBegin();
        try {
            foreach ($karyawan as $karyawanRow) {
                $kid = (int) $karyawanRow['id'];
                $absen = $db->table('absensi')->where('karyawan_id', $kid)->where('tanggal', $tanggal)->get()->getRowArray();
                if ($absen) {
                    continue;
                }

                $izin = $db->table('pengajuan_izin')
                    ->where('karyawan_id', $kid)
                    ->whereIn('jenis', ['izin', 'sakit', 'cuti'])
                    ->where('status', 'disetujui')
                    ->where('tanggal_mulai <=', $tanggal)
                    ->where('tanggal_selesai >=', $tanggal)
                    ->countAllResults();
                if ($izin > 0) {
                    continue;
                }

                $db->table('absensi')->insert([
                    'karyawan_id'     => $kid,
                    'tanggal'         => $tanggal,
                    'status'          => 'alpha',
                    'menit_terlambat' => 0,
                    'durasi_menit'    => null,
                    'lembur_menit'    => 0,
                    'sumber'          => 'sistem',
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ]);
                $inserted++;
            }
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            CLI::error('Gagal menutup absensi: ' . $e->getMessage());
            return;
        }

        CLI::write("{$inserted} baris alpha dibuat untuk {$tanggal}.", 'green');
    }
}
