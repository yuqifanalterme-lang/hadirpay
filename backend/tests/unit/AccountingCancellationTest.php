<?php

use App\Services\AccountingService;
use App\Services\PayrollCancellationPolicy;
use CodeIgniter\Test\CIUnitTestCase;

final class AccountingCancellationTest extends CIUnitTestCase
{
    public function testReversalSwapsDebitAndCreditAndKeepsJournalBalanced(): void
    {
        $original = [
            ['akun_id' => 3, 'debit' => 125000.25, 'kredit' => 0],
            ['akun_id' => 7, 'debit' => 0, 'kredit' => 100000.00],
            ['akun_id' => 9, 'debit' => 0, 'kredit' => 25000.25],
        ];

        $reversal = AccountingService::barisPembalik($original);
        $totalDebit = array_sum(array_map(static fn ($line) => AccountingService::sen($line['debit']), $reversal));
        $totalCredit = array_sum(array_map(static fn ($line) => AccountingService::sen($line['kredit']), $reversal));

        $this->assertSame($totalDebit, $totalCredit);
        $this->assertSame($original[0]['kredit'], $reversal[0]['debit']);
        $this->assertSame($original[0]['debit'], $reversal[0]['kredit']);
    }

    public function testCancelledJournalPairNetsToZeroPerAccount(): void
    {
        $original = [
            ['akun_id' => 3, 'debit' => 500000, 'kredit' => 0],
            ['akun_id' => 7, 'debit' => 0, 'kredit' => 400000],
            ['akun_id' => 9, 'debit' => 0, 'kredit' => 100000],
        ];
        $pair = array_merge($original, AccountingService::barisPembalik($original));
        $netByAccount = [];

        foreach ($pair as $line) {
            $accountId = $line['akun_id'];
            $netByAccount[$accountId] = ($netByAccount[$accountId] ?? 0)
                + AccountingService::sen($line['debit'])
                - AccountingService::sen($line['kredit']);
        }

        $this->assertSame([3 => 0, 7 => 0, 9 => 0], $netByAccount);
    }

    public function testUnauthorizedRoleIsRejectedWith403(): void
    {
        foreach (['pemilik', 'karyawan', ''] as $role) {
            $error = PayrollCancellationPolicy::error($role, [
                'status' => 'dibayar',
                'ditutup' => 0,
            ], 'Koreksi');

            $this->assertSame(403, $error['status']);
            $this->assertSame('FORBIDDEN', $error['code']);
        }
    }

    public function testEmptyReasonAndAlreadyCancelledPeriodAreRejected(): void
    {
        $emptyReason = PayrollCancellationPolicy::error('admin_hrd', [
            'status' => 'disetujui',
            'ditutup' => 0,
        ], '   ');
        $alreadyCancelled = PayrollCancellationPolicy::error('keuangan', [
            'status' => 'dibatalkan',
            'ditutup' => 0,
        ], 'Koreksi');

        $this->assertSame(422, $emptyReason['status']);
        $this->assertSame('VALIDATION_ERROR', $emptyReason['code']);
        $this->assertSame(409, $alreadyCancelled['status']);
        $this->assertSame('INVALID_STATUS_TRANSITION', $alreadyCancelled['code']);
    }

    public function testClosedPeriodCanBeCancelledAndAutomaticJournalDeletionIsRejected(): void
    {
        $periodError = PayrollCancellationPolicy::error('keuangan', [
            'status' => 'dibayar',
            'ditutup' => 1,
        ], 'Koreksi');
        $journalError = AccountingService::errorHapusJurnalLangsung([
            'sumber' => 'otomatis',
            'status' => 'aktif',
        ]);
        $manualAllowed = AccountingService::errorHapusJurnalLangsung([
            'sumber' => 'manual',
            'status' => 'aktif',
        ]);

        $this->assertNull($periodError);
        $this->assertSame(403, $journalError['status']);
        $this->assertSame('FORBIDDEN', $journalError['code']);
        $this->assertNull($manualAllowed);
    }
}
