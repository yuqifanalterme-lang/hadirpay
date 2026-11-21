<?php

use App\Services\PayrollService;
use CodeIgniter\Test\CIUnitTestCase;

final class PayrollServiceTest extends CIUnitTestCase
{
    public function testAndiOctoberSlipExpectedValues(): void
    {
        $service = new PayrollService();
        $hariKerja = [];
        $absensi = [];
        for ($tanggal = new DateTimeImmutable('2026-10-01'); $tanggal <= new DateTimeImmutable('2026-10-31'); $tanggal = $tanggal->modify('+1 day')) {
            if ((int) $tanggal->format('N') > 5) {
                continue;
            }

            $date = $tanggal->format('Y-m-d');
            $hariKerja[] = $date;
            $absensi[$date] = [
                'status' => 'hadir',
                'menit_terlambat' => 0,
                'lembur_menit' => 0,
                'durasi_menit' => 555,
            ];
        }

        $absensi['2026-10-05']['status'] = 'alpha';
        $absensi['2026-10-09']['status'] = 'terlambat';
        $absensi['2026-10-09']['menit_terlambat'] = 20;
        $absensi['2026-10-15']['lembur_menit'] = 240;

        $komponen = [
            1 => ['id' => 1, 'kode' => 'TUN-TRANSPORT', 'nama' => 'Tunjangan transport', 'tipe' => 'pendapatan', 'metode' => 'nominal_tetap', 'nilai' => 245000, 'aktif' => 1],
            2 => ['id' => 2, 'kode' => 'LEMBUR', 'nama' => 'Upah lembur', 'tipe' => 'pendapatan', 'metode' => 'per_jam', 'nilai' => 25000, 'aktif' => 1],
            3 => ['id' => 3, 'kode' => 'POT-ALPHA', 'nama' => 'Potongan alpha', 'tipe' => 'potongan', 'metode' => 'per_hari', 'nilai' => null, 'aktif' => 1],
            4 => ['id' => 4, 'kode' => 'POT-TELAT', 'nama' => 'Potongan keterlambatan', 'tipe' => 'potongan', 'metode' => 'per_menit', 'nilai' => 1000, 'aktif' => 1],
            5 => ['id' => 5, 'kode' => 'BPJS', 'nama' => 'Iuran BPJS', 'tipe' => 'potongan', 'metode' => 'persen', 'nilai' => 1, 'aktif' => 1],
            6 => ['id' => 6, 'kode' => 'POT-LAIN', 'nama' => 'Potongan lainnya', 'tipe' => 'potongan', 'metode' => 'nominal_tetap', 'nilai' => 0, 'aktif' => 1],
        ];
        $byKode = [];
        foreach ($komponen as $row) {
            $byKode[$row['kode']] = $row;
        }

        $hasil = $service->hitungKaryawan(
            [
                'id' => 2,
                'jenis_penggajian' => 'bulanan',
                'gaji_pokok' => 4500000,
                'tunjangan_tetap' => 0,
                'tanggal_mulai' => '2020-06-08',
            ],
            $hariKerja,
            $komponen,
            $byKode,
            [1 => 245000, 5 => 1, 6 => 200000],
            $absensi,
            [],
            '2026-11-01'
        );

        $this->assertCount(22, $hariKerja);
        $this->assertSame(1, json_decode($hasil['penggajian']['rekap_json'], true)['alpha']);
        $this->assertSame(4845000.0, $hasil['penggajian']['total_pendapatan']);
        $this->assertSame(469545.45, $hasil['penggajian']['total_potongan']);
        $this->assertSame(4375454.55, $hasil['penggajian']['gaji_bersih']);
        $this->assertSame(204545.45, $hasil['penggajian']['tarif_harian']);
    }

    public function testCastUangUsesTwoDecimals(): void
    {
        $cast = PayrollService::castUang([
            'gaji_pokok' => '4500000.00',
            'total_pendapatan' => '4845000.001',
            'gaji_bersih' => '4375454.554',
        ]);

        $this->assertSame(4500000.0, $cast['gaji_pokok']);
        $this->assertSame(4845000.0, $cast['total_pendapatan']);
        $this->assertSame(4375454.55, $cast['gaji_bersih']);
    }
}
