<?php

use App\Services\JournalSummary;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

final class JournalSummaryTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $migrate = false;
    protected $refresh = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->createJurnalTable();
    }

    public function testSummaryCountsAllFilteredJournalsBeyondOnePage(): void
    {
        for ($id = 1; $id <= 12; $id++) {
            $this->insertJurnal($id, '100.01', '100.01');
        }
        $this->insertJurnal(13, '5000.00', '5000.00', 'aktif', 'otomatis');
        $this->insertJurnal(14, '9000.00', '9000.00', 'dibatalkan');

        $summary = JournalSummary::fromFilteredQuery(
            fn () => $this->db->table('jurnal j')->where('j.sumber', 'manual'),
        );

        $this->assertSame('1200.12', $summary['total_debit']);
        $this->assertSame('1200.12', $summary['total_kredit']);
        $this->assertSame('0.00', $summary['selisih']);
        $this->assertTrue($summary['seimbang']);
        $this->assertSame(12, $summary['jumlah_jurnal']);
    }

    public function testSummaryFollowsActiveFilters(): void
    {
        $this->insertJurnal(1, '10.00', '10.00', 'aktif', 'manual', '2026-10-01');
        $this->insertJurnal(2, '20.00', '20.00', 'aktif', 'manual', '2026-10-02');
        $this->insertJurnal(3, '30.00', '30.00', 'aktif', 'otomatis', '2026-10-02');

        $summary = JournalSummary::fromFilteredQuery(
            fn () => $this->db->table('jurnal j')
                ->where('j.tanggal >=', '2026-10-02')
                ->where('j.sumber', 'manual'),
        );

        $this->assertSame('20.00', $summary['total_debit']);
        $this->assertSame('20.00', $summary['total_kredit']);
        $this->assertSame(1, $summary['jumlah_jurnal']);
    }

    public function testSummaryIgnoresCancelledJournals(): void
    {
        $this->insertJurnal(1, '0.10', '0.10');
        $this->insertJurnal(2, '50.00', '50.00', 'dibatalkan');

        $summary = JournalSummary::fromFilteredQuery(fn () => $this->db->table('jurnal j'));

        $this->assertSame('0.10', $summary['total_debit']);
        $this->assertSame('0.10', $summary['total_kredit']);
        $this->assertSame(1, $summary['jumlah_jurnal']);
    }

    public function testDecimalTotalsUseExactCentsAndDetectAnImbalance(): void
    {
        $this->insertJurnal(1, '0.10', '0.10');
        $this->insertJurnal(2, '0.20', '0.20');
        $balanced = JournalSummary::fromFilteredQuery(fn () => $this->db->table('jurnal j'));

        $this->assertSame('0.30', $balanced['total_debit']);
        $this->assertSame('0.30', $balanced['total_kredit']);
        $this->assertTrue($balanced['seimbang']);

        $this->db->table('jurnal')->truncate();
        $this->insertJurnal(3, '0.30', '0.20');
        $unbalanced = JournalSummary::fromFilteredQuery(fn () => $this->db->table('jurnal j'));

        $this->assertSame('0.30', $unbalanced['total_debit']);
        $this->assertSame('0.20', $unbalanced['total_kredit']);
        $this->assertSame('0.10', $unbalanced['selisih']);
        $this->assertFalse($unbalanced['seimbang']);
    }

    public function testEmptySummaryIsBalancedAtZero(): void
    {
        $summary = JournalSummary::fromFilteredQuery(fn () => $this->db->table('jurnal j'));

        $this->assertSame('0.00', $summary['total_debit']);
        $this->assertSame('0.00', $summary['total_kredit']);
        $this->assertSame('0.00', $summary['selisih']);
        $this->assertTrue($summary['seimbang']);
        $this->assertSame(0, $summary['jumlah_jurnal']);
    }

    private function createJurnalTable(): void
    {
        $table = $this->db->prefixTable('jurnal');
        $this->db->query("DROP TABLE IF EXISTS {$table}");
        $this->db->query(
            "CREATE TABLE {$table} (
                id INTEGER PRIMARY KEY,
                tanggal DATE NOT NULL,
                sumber VARCHAR(20) NOT NULL,
                total_debit DECIMAL(15,2) NOT NULL,
                total_kredit DECIMAL(15,2) NOT NULL,
                status VARCHAR(20) NOT NULL
            )",
        );
    }

    private function insertJurnal(
        int $id,
        string $debit,
        string $kredit,
        string $status = 'aktif',
        string $sumber = 'manual',
        string $tanggal = '2026-10-01',
    ): void {
        $this->db->table('jurnal')->insert([
            'id'            => $id,
            'tanggal'       => $tanggal,
            'sumber'        => $sumber,
            'total_debit'   => $debit,
            'total_kredit'  => $kredit,
            'status'        => $status,
        ]);
    }
}
