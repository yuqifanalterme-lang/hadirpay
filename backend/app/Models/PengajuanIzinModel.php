<?php

namespace App\Models;

use CodeIgniter\Model;

class PengajuanIzinModel extends Model
{
    protected $table         = 'pengajuan_izin';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = [
        'karyawan_id', 'jenis', 'tanggal_mulai', 'tanggal_selesai', 'jumlah_hari',
        'alasan', 'lampiran_path', 'data_json', 'status',
        'diproses_oleh', 'diproses_pada', 'alasan_penolakan',
    ];

    public const JENIS_HARI = ['izin', 'sakit', 'cuti'];

    /**
     * Hitung hari kerja: ikut jadwal_kerja default (is_default = 1),
     * dan hari libur nasional/perusahaan (hari_libur) tidak dihitung.
     */
    public function hitungHariKerja(string $mulai, string $selesai): float
    {
        $namaHari = [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu', 7 => 'minggu'];

        $jadwal = $this->db->table('jadwal_kerja')
            ->select('hari_kerja')
            ->where('is_default', 1)
            ->get()->getRowArray();

        $hariKerja = $jadwal
            ? array_filter(array_map('trim', explode(',', strtolower($jadwal['hari_kerja']))))
            : ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];

        $libur = array_column(
            $this->db->table('hari_libur')
                ->select('tanggal')
                ->where('tanggal >=', $mulai)
                ->where('tanggal <=', $selesai)
                ->get()->getResultArray(),
            'tanggal'
        );

        $total = 0;
        $d     = new \DateTime($mulai);
        $akhir = new \DateTime($selesai);
        while ($d <= $akhir) {
            $nama = $namaHari[(int) $d->format('N')];
            if (in_array($nama, $hariKerja, true) && ! in_array($d->format('Y-m-d'), $libur, true)) {
                $total++;
            }
            $d->modify('+1 day');
        }
        return (float) $total;
    }

    public function adaTumpangTindih(int $karyawanId, string $mulai, string $selesai): bool
    {
        return $this->where('karyawan_id', $karyawanId)
            ->whereIn('jenis', self::JENIS_HARI)
            ->whereIn('status', ['menunggu', 'disetujui'])
            ->where('tanggal_mulai <=', $selesai)
            ->where('tanggal_selesai >=', $mulai)
            ->countAllResults() > 0;
    }

    public static function format(array $r): array
    {
        $r['jumlah_hari'] = (float) $r['jumlah_hari'];
        $r['data_json']   = $r['data_json'] ? json_decode($r['data_json'], true) : null;
        return $r;
    }
}