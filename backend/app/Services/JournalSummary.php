<?php

namespace App\Services;

class JournalSummary
{
    /**
     * @return array{total_debit:string, total_kredit:string, selisih:string, seimbang:bool, jumlah_jurnal:int}
     */
    public static function fromFilteredQuery(callable $queryFactory): array
    {
        $row = $queryFactory()
            ->where('j.status', 'aktif')
            ->select('COALESCE(SUM(CAST(ROUND(j.total_debit * 100, 0) AS SIGNED)), 0) AS total_debit_sen', false)
            ->select('COALESCE(SUM(CAST(ROUND(j.total_kredit * 100, 0) AS SIGNED)), 0) AS total_kredit_sen', false)
            ->select('COUNT(DISTINCT j.id) AS jumlah_jurnal', false)
            ->get()->getRowArray();

        $totalDebitSen  = (int) ($row['total_debit_sen'] ?? 0);
        $totalKreditSen = (int) ($row['total_kredit_sen'] ?? 0);
        $selisihSen     = abs($totalDebitSen - $totalKreditSen);

        return [
            'total_debit'  => self::rupiahDariSen($totalDebitSen),
            'total_kredit' => self::rupiahDariSen($totalKreditSen),
            'selisih'      => self::rupiahDariSen($selisihSen),
            'seimbang'     => $selisihSen === 0,
            'jumlah_jurnal' => (int) ($row['jumlah_jurnal'] ?? 0),
        ];
    }

    private static function rupiahDariSen(int $sen): string
    {
        $tanda = $sen < 0 ? '-' : '';
        $sen   = abs($sen);

        return $tanda . intdiv($sen, 100) . '.' . str_pad((string) ($sen % 100), 2, '0', STR_PAD_LEFT);
    }
}
