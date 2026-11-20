<?php

namespace App\Libraries;

class Tanggal
{
    public const BULAN = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
        7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];

    /** "2026-11" -> "November 2026" */
    public static function labelPeriode(string $periode): string
    {
        $p = explode('-', $periode);
        if (count($p) !== 2) {
            return $periode;
        }
        return (self::BULAN[(int) $p[1]] ?? $p[1]) . ' ' . $p[0];
    }

    public static function waktuIso(?string $dt): ?string
    {
        return $dt ? (new \DateTimeImmutable($dt))->format('c') : null;
    }
}