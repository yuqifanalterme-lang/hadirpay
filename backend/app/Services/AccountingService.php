<?php

namespace App\Services;

use App\Libraries\Tanggal;

/**
 * Jurnal otomatis dari payroll.
 *
 * Pengakuan (saat periode disetujui):
 *   Debit  Beban Gaji         = gaji bersih + PPh 21 + BPJS
 *   Kredit Utang Gaji         = total gaji bersih
 *   Kredit Utang PPh 21       = total potongan komponen PPH21 (jika ada)
 *   Kredit Utang Iuran BPJS   = total potongan komponen BPJS (jika ada)
 * Potongan keterlambatan, alpha, dan lain-lain bukan utang, tetapi mengurangi beban.
 * Debit dihitung dari kredit supaya jurnal selalu seimbang.
 *
 * Pembayaran (saat periode dibayar):
 *   Debit  Utang Gaji = total gaji bersih
 *   Kredit Kas/Bank
 */
class AccountingService
{
    public const AKUN_KAS   = '1-1100';
    public const AKUN_UTANG = '2-1100';
    public const AKUN_PPH   = '2-1200';
    public const AKUN_BPJS  = '2-1300';
    public const AKUN_BEBAN = '5-1100';

    /** Rupiah ke sen (integer) supaya tidak ada selisih pembulatan desimal. */
    public static function sen($v): int
    {
        return (int) round(((float) $v) * 100);
    }

    public static function nomorBukti($db, string $tanggal): string
    {
        $t      = strtotime($tanggal);
        $prefix = 'JU/' . date('Y', $t) . '/' . date('m', $t) . '/';
        $row    = $db->query('SELECT MAX(nomor_bukti) AS m FROM jurnal WHERE nomor_bukti LIKE ? FOR UPDATE', [$prefix . '%'])->getRowArray();
        $n      = ($row && $row['m']) ? ((int) substr($row['m'], -4)) + 1 : 1;

        return $prefix . sprintf('%04d', $n);
    }

    /**
     * Simpan jurnal beserta barisnya. Wajib dipanggil di dalam transaksi.
     *
     * @param array<string, mixed> $header
     * @param list<array{akun_id:int, debit:mixed, kredit:mixed}> $lines
     */
    public static function simpanJurnal($db, array $header, array $lines): int
    {
        $d = 0;
        $k = 0;
        foreach ($lines as $l) {
            $d += self::sen($l['debit']);
            $k += self::sen($l['kredit']);
        }
        if ($d !== $k || $d === 0) {
            throw new \DomainException('Jurnal tidak seimbang atau nilainya nol, jurnal tidak bisa dibuat');
        }

        $now = date('Y-m-d H:i:s');
        $db->table('jurnal')->insert([
            'nomor_bukti'     => self::nomorBukti($db, $header['tanggal']),
            'tanggal'         => $header['tanggal'],
            'keterangan'      => mb_substr($header['keterangan'], 0, 255),
            'sumber'          => $header['sumber'],
            'jenis'           => $header['jenis'],
            'periode_gaji_id' => $header['periode_gaji_id'] ?? null,
            'total_debit'     => $d / 100,
            'total_kredit'    => $k / 100,
            'status'          => 'aktif',
            'dibuat_oleh'     => $header['dibuat_oleh'] ?? null,
            'created_at'      => $now,
            'updated_at'      => $now,
        ]);
        $id = (int) $db->insertID();

        self::isiDetail($db, $id, $lines);

        return $id;
    }

    public static function batalkanJurnal($db, int $jurnalId, ?int $userId, string $alasan, ?string $now = null): void
    {
        $waktu = $now ?? date('Y-m-d H:i:s');
        $db->table('jurnal')->where('id', $jurnalId)->update([
            'status'            => 'dibatalkan',
            'dibatalkan_oleh'   => ($userId !== null && $userId > 0) ? $userId : null,
            'dibatalkan_pada'   => $waktu,
            'alasan_pembatalan' => mb_substr(trim($alasan), 0, 255),
            'updated_at'        => $waktu,
        ]);
    }

    /** @param list<array{akun_id:int, debit:mixed, kredit:mixed}> $lines */
    public static function isiDetail($db, int $jurnalId, array $lines): void
    {
        $batch = [];
        foreach (array_values($lines) as $i => $l) {
            $batch[] = [
                'jurnal_id' => $jurnalId,
                'akun_id'   => (int) $l['akun_id'],
                'debit'     => self::sen($l['debit']) / 100,
                'kredit'    => self::sen($l['kredit']) / 100,
                'urutan'    => min($i + 1, 255),
            ];
        }
        $db->table('detail_jurnal')->insertBatch($batch);
    }

    public static function akunId($db, string $kode): int
    {
        $r = $db->table('akun')->select('id')->where('kode', $kode)->where('aktif', 1)->get()->getRowArray();
        if (! $r) {
            throw new \DomainException("Akun {$kode} belum ada atau tidak aktif. Atur dulu di Data Akun");
        }
        return (int) $r['id'];
    }

    public static function jurnalPengakuan($db, array $periode, int $userId): int
    {
        $pid = (int) $periode['id'];

        $tot = $db->table('penggajian')
            ->select('COALESCE(SUM(gaji_bersih),0) AS bersih', false)
            ->where('periode_gaji_id', $pid)
            ->get()->getRowArray();

        $pot = $db->table('detail_penggajian d')
            ->select('k.kode AS kode, COALESCE(SUM(d.jumlah),0) AS total', false)
            ->join('penggajian g', 'g.id = d.penggajian_id')
            ->join('komponen_gaji k', 'k.id = d.komponen_id', 'left')
            ->where('g.periode_gaji_id', $pid)
            ->where('d.tipe', 'potongan')
            ->groupBy('k.kode')
            ->get()->getResultArray();

        $pph  = 0.0;
        $bpjs = 0.0;
        foreach ($pot as $r) {
            if ($r['kode'] === 'PPH21') {
                $pph += (float) $r['total'];
            } elseif ($r['kode'] === 'BPJS') {
                $bpjs += (float) $r['total'];
            }
        }

        $bersih = (float) $tot['bersih'];
        $beban  = $bersih + $pph + $bpjs;

        $lines = [
            ['akun_id' => self::akunId($db, self::AKUN_BEBAN), 'debit' => $beban, 'kredit' => 0],
            ['akun_id' => self::akunId($db, self::AKUN_UTANG), 'debit' => 0, 'kredit' => $bersih],
        ];
        if ($pph > 0) {
            $lines[] = ['akun_id' => self::akunId($db, self::AKUN_PPH), 'debit' => 0, 'kredit' => $pph];
        }
        if ($bpjs > 0) {
            $lines[] = ['akun_id' => self::akunId($db, self::AKUN_BPJS), 'debit' => 0, 'kredit' => $bpjs];
        }

        return self::simpanJurnal($db, [
            'tanggal'         => $periode['tanggal_tutup'],
            'keterangan'      => 'Pengakuan beban gaji periode ' . Tanggal::labelPeriode($periode['periode']),
            'sumber'          => 'otomatis',
            'jenis'           => 'pengakuan_gaji',
            'periode_gaji_id' => $pid,
            'dibuat_oleh'     => $userId > 0 ? $userId : null,
        ], $lines);
    }

    public static function jurnalPembayaran($db, array $periode, int $userId, int $akunKasId, string $tanggal): int
    {
        $tot = $db->table('penggajian')
            ->select('COALESCE(SUM(gaji_bersih),0) AS bersih', false)
            ->where('periode_gaji_id', (int) $periode['id'])
            ->get()->getRowArray();

        $bersih = (float) $tot['bersih'];

        return self::simpanJurnal($db, [
            'tanggal'         => $tanggal,
            'keterangan'      => 'Pembayaran gaji periode ' . Tanggal::labelPeriode($periode['periode']),
            'sumber'          => 'otomatis',
            'jenis'           => 'pembayaran_gaji',
            'periode_gaji_id' => (int) $periode['id'],
            'dibuat_oleh'     => $userId > 0 ? $userId : null,
        ], [
            ['akun_id' => self::akunId($db, self::AKUN_UTANG), 'debit' => $bersih, 'kredit' => 0],
            ['akun_id' => $akunKasId, 'debit' => 0, 'kredit' => $bersih],
        ]);
    }
}