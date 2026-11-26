<?php

namespace App\Services;

/** Bentuk rincian gaji satu karyawan sesuai kontrak (GET /penggajian/{id} dan isi slip gaji). */
class PayslipFormatter
{
    public static function detail(int $penggajianId): ?array
    {
        $db = db_connect();

        $g = $db->table('penggajian g')
            ->select('g.*, p.periode, k.kode AS karyawan_kode, k.nama AS karyawan_nama, '
                . 'd.nama AS departemen_nama, j.nama AS jabatan_nama')
            ->join('periode_gaji p', 'p.id = g.periode_gaji_id')
            ->join('karyawan k', 'k.id = g.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->join('jabatan j', 'j.id = k.jabatan_id', 'left')
            ->where('g.id', $penggajianId)
            ->get()->getRowArray();

        if (! $g) {
            return null;
        }

        $rekap = $g['rekap_json'] ? (json_decode($g['rekap_json'], true) ?: []) : [];
        $kehadiran = [
            'hari_kerja'            => (int) ($rekap['hari_kerja_periode'] ?? 0),
            'hadir'                 => (int) ($rekap['hadir'] ?? 0),
            'terlambat'             => (int) ($rekap['terlambat'] ?? 0),
            'izin'                  => (int) ($rekap['izin'] ?? 0),
            'sakit'                 => (int) ($rekap['sakit'] ?? 0),
            'cuti'                  => (int) ($rekap['cuti'] ?? 0),
            'alpha'                 => (int) ($rekap['alpha'] ?? 0),
            'total_menit_terlambat' => (int) ($rekap['menit_terlambat'] ?? 0),
        ];
        $rincian = $db->table('detail_penggajian')
            ->where('penggajian_id', $penggajianId)
            ->orderBy('urutan', 'ASC')->orderBy('id', 'ASC')
            ->get()->getResultArray();

        return [
            'id'       => (int) $g['id'],
            'periode'  => $g['periode'],
            'karyawan' => [
                'id'         => (int) $g['karyawan_id'],
                'kode'       => $g['karyawan_kode'],
                'nama'       => $g['karyawan_nama'],
                'jabatan'    => $g['jabatan_nama'],
                'departemen' => $g['departemen_nama'],
            ],
            'kehadiran' => $kehadiran,
            'tarif_harian' => (float) $g['tarif_harian'],
            'rincian'      => array_map(static fn ($r) => [
                'id'          => (int) $r['id'],
                'komponen_id' => $r['komponen_id'] !== null ? (int) $r['komponen_id'] : null,
                'kode'        => $r['kode'],
                'sumber'      => $r['sumber'],
                'nama'        => $r['nama'],
                'tipe'        => $r['tipe'],
                'keterangan'  => $r['keterangan'],
                'jumlah'      => (float) $r['jumlah'],
            ], $rincian),
            'total_pendapatan' => (float) $g['total_pendapatan'],
            'total_potongan'   => (float) $g['total_potongan'],
            'gaji_bersih'      => (float) $g['gaji_bersih'],
        ];
    }
}