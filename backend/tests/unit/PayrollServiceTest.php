<?php

use App\Services\PayrollService;
use CodeIgniter\Test\CIUnitTestCase;

final class PayrollServiceTest extends CIUnitTestCase
{
    public function testAndiOctoberSlipExpectedValues(): void
    {
        $pendapatan = PayrollService::roundMoney(4500000 + 245000 + 100000);
        $potongan = PayrollService::roundMoney(204545.45 + 20000 + 45000 + 200000);
        $bersih = PayrollService::roundMoney($pendapatan - $potongan);
        $tarifHarian = PayrollService::roundMoney(4500000 / 22);

        $this->assertSame(4845000.0, $pendapatan);
        $this->assertSame(469545.45, $potongan);
        $this->assertSame(4375454.55, $bersih);
        $this->assertSame(204545.45, $tarifHarian);
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
