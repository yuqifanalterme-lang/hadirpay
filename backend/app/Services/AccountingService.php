<?php

namespace App\Services;

use App\Libraries\Tanggal;

/**
 * Jurnal otomatis dari payroll.
 *
 * Pengakuan (saat periode disetujui) mencatat beban bruto dan memisahkan utang gaji,
 * PPh 21, BPJS, serta potongan karyawan lainnya.
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
    public const AKUN_POTONGAN = '2-1500';
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
            'reversal_of'     => $header['reversal_of'] ?? null,
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
            'cancelled_by'      => ($userId !== null && $userId > 0) ? $userId : null,
            'cancelled_at'      => $waktu,
            'cancel_reason'     => mb_substr(trim($alasan), 0, 255),
            'updated_at'        => $waktu,
        ]);
    }

    /** @param list<array{akun_id:int, debit:mixed, kredit:mixed}> $lines */
    public static function barisPembalik(array $lines): array
    {
        return array_map(static fn ($line) => [
            'akun_id' => (int) $line['akun_id'],
            'debit'   => $line['kredit'],
            'kredit'  => $line['debit'],
        ], $lines);
    }

    public static function jurnalPembalik($db, array $original, int $userId, string $now): int
    {
        $rows = $db->table('detail_jurnal')
            ->select('akun_id, debit, kredit')
            ->where('jurnal_id', (int) $original['id'])
            ->orderBy('urutan', 'ASC')
            ->orderBy('id', 'ASC')
            ->get()->getResultArray();
        if (! $rows) {
            throw new \DomainException('Jurnal otomatis tidak memiliki rincian untuk dibalik');
        }

        return self::simpanJurnal($db, [
            'tanggal'         => substr($now, 0, 10),
            'keterangan'      => 'Pembalik: ' . $original['keterangan'],
            'sumber'          => $original['sumber'],
            'jenis'           => $original['jenis'],
            'periode_gaji_id' => $original['periode_gaji_id'],
            'reversal_of'     => (int) $original['id'],
            'dibuat_oleh'     => $userId > 0 ? $userId : null,
        ], self::barisPembalik($rows));
    }

    /** @return array{code:string, message:string, status:int}|null */
    public static function errorHapusJurnalLangsung(array $jurnal): ?array
    {
        if ($jurnal['sumber'] !== 'manual') {
            return [
                'code'    => 'FORBIDDEN',
                'message' => 'Jurnal otomatis tidak boleh diubah atau dihapus',
                'status'  => 403,
            ];
        }
        if (($jurnal['status'] ?? 'aktif') === 'dibatalkan') {
            return [
                'code'    => 'INVALID_STATUS_TRANSITION',
                'message' => 'Jurnal sudah dibatalkan',
                'status'  => 409,
            ];
        }
        return null;
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

        $netPay = (float) $db->table('penggajian')
            ->select('COALESCE(SUM(gaji_bersih),0) AS total', false)
            ->where('periode_gaji_id', $pid)
            ->get()->getRowArray()['total'];
        $deductions = $db->table('detail_penggajian dp')
            ->select('dp.kode, kg.kode AS master_kode, SUM(dp.jumlah) AS total', false)
            ->join('penggajian p', 'p.id = dp.penggajian_id')
            ->join('komponen_gaji kg', 'kg.id = dp.komponen_id', 'left')
            ->where('p.periode_gaji_id', $pid)
            ->where('dp.tipe', 'potongan')
            ->groupBy(['dp.kode', 'kg.kode'])
            ->get()->getResultArray();
        $withheld = [];
        foreach ($deductions as $row) {
            $kode = $row['kode'] ?: $row['master_kode'];
            $withheld[$kode] = ($withheld[$kode] ?? 0.0) + (float) $row['total'];
        }

        $incomeTax = $withheld['PPH21'] ?? 0.0;
        $bpjs = $withheld['BPJS'] ?? 0.0;
        $alpha = $withheld['POT-ALPHA'] ?? 0.0;
        $late = $withheld['POT-TELAT'] ?? 0.0;
        $otherDeductions = array_sum(array_diff_key($withheld, [
            'PPH21' => true,
            'BPJS' => true,
            'POT-ALPHA' => true,
            'POT-TELAT' => true,
        ]));
        $totalPendapatan = (float) $db->table('penggajian')
            ->select('COALESCE(SUM(total_pendapatan),0) AS total', false)
            ->where('periode_gaji_id', $pid)
            ->get()->getRowArray()['total'];
        $grossPay = round($totalPendapatan - $alpha - $late, 2);
        $lines = [
            ['akun_id' => self::akunId($db, self::AKUN_BEBAN), 'debit' => $grossPay, 'kredit' => 0],
            ['akun_id' => self::akunId($db, self::AKUN_UTANG), 'debit' => 0, 'kredit' => $netPay],
        ];
        foreach ([
            [self::AKUN_PPH, $incomeTax],
            [self::AKUN_BPJS, $bpjs],
            [self::AKUN_POTONGAN, $otherDeductions],
        ] as [$accountCode, $amount]) {
            if ($amount > 0) {
                $lines[] = ['akun_id' => self::akunId($db, $accountCode), 'debit' => 0, 'kredit' => $amount];
            }
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