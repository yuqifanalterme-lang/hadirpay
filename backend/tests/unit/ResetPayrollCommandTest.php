<?php

use App\Commands\ResetPayroll;
use App\Services\AccountingService;
use CodeIgniter\CLI\CLI;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\Mock\MockInputOutput;

final class ResetPayrollCommandTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $migrate = false;
    protected $refresh = false;

    private array $transactionTables = [
        'detail_jurnal',
        'slip_gaji',
        'detail_penggajian',
        'jurnal',
        'penggajian',
        'periode_status_log',
        'periode_gaji',
    ];

    private array $attendanceTables = ['absensi', 'pengajuan_izin'];

    private array $masterTables = [
        'users',
        'karyawan',
        'jabatan',
        'departemen',
        'akun',
        'komponen_gaji',
        'karyawan_komponen',
        'pengaturan',
        'jadwal_kerja',
        'lokasi_absensi',
        'hari_libur',
        'kuota_cuti',
        'refresh_tokens',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->dropSchema();
        $this->createSchema();
        $this->seedData();
    }

    public function testDefaultRunIsDryRunAndReportsTargetCounts(): void
    {
        $command = $this->makeCommand();
        [$exitCode, $output] = $this->runWithOutput($command, []);

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('DRY-RUN', $output);
        $this->assertStringContainsString('Target database:', $output);
        $this->assertStringContainsString('Target host:', $output);
        $this->assertStringContainsString('detail_jurnal: 1 row(s)', $output);

        foreach ($this->transactionTables as $table) {
            $expected = $table === 'jurnal' ? 2 : 1;
            $this->assertSame($expected, $this->countRows($table), $table);
        }
        foreach ($this->attendanceTables as $table) {
            $this->assertSame(1, $this->countRows($table), $table);
        }
    }

    public function testForceDeletesOnlyTransactionTablesAndPreservesMasters(): void
    {
        $mastersBefore = $this->masterSnapshot();
        $command = $this->makeCommand();
        [$exitCode, $output] = $this->runWithOutput($command, ['force' => true], [$this->db->getDatabase()]);

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('Deleted rows:', $output);

        foreach ($this->transactionTables as $table) {
            $this->assertSame(0, $this->countRows($table), $table);
        }
        foreach ($this->attendanceTables as $table) {
            $this->assertSame(1, $this->countRows($table), $table);
        }
        $this->assertSame($mastersBefore, $this->masterSnapshot());
    }

    public function testAttendanceTablesAreOnlyDeletedWithExplicitOption(): void
    {
        $mastersBefore = $this->masterSnapshot();
        $command = $this->makeCommand();
        [$exitCode] = $this->runWithOutput($command, [
            'force'           => true,
            'with-attendance' => true,
        ], [$this->db->getDatabase()]);

        $this->assertSame(0, $exitCode);
        foreach (array_merge($this->transactionTables, $this->attendanceTables) as $table) {
            $this->assertSame(0, $this->countRows($table), $table);
        }
        $this->assertSame($mastersBefore, $this->masterSnapshot());
    }

    public function testMismatchedDatabaseConfirmationDoesNotDeleteRows(): void
    {
        $command = $this->makeCommand();
        [$exitCode, $output] = $this->runWithOutput($command, ['force' => true], ['different_database']);

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('did not match', $output);
        $this->assertSame(2, $this->countRows('jurnal'));
        $this->assertSame(1, $this->countRows('detail_jurnal'));
    }

    public function testProductionRequiresExplicitOverrideAndDatabaseConfirmation(): void
    {
        $blocked = $this->makeCommand('production');
        [$blockedExitCode, $blockedOutput] = $this->runWithOutput($blocked, ['force' => true]);

        $this->assertSame(1, $blockedExitCode);
        $this->assertStringContainsString('--i-know-this-is-production', $blockedOutput);
        $this->assertSame(2, $this->countRows('jurnal'));

        $allowed = $this->makeCommand('production');
        [$allowedExitCode] = $this->runWithOutput($allowed, [
            'force'                     => true,
            'i-know-this-is-production' => true,
        ], [$this->db->getDatabase()]);

        $this->assertSame(0, $allowedExitCode);
        $this->assertSame(0, $this->countRows('jurnal'));
    }

    public function testFailureRollsBackAllEarlierDeletesAndReferenceUpdates(): void
    {
        $this->db->query(
            'CREATE TRIGGER ' . $this->db->prefixTable('fail_jurnal_delete')
            . ' BEFORE DELETE ON ' . $this->db->prefixTable('jurnal')
            . " BEGIN SELECT RAISE(ABORT, 'forced delete failure'); END"
        );
        $command = $this->makeCommand();
        [$exitCode, $output] = $this->runWithOutput($command, ['force' => true], [$this->db->getDatabase()]);

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('rolled back', strtolower($output));
        $this->assertSame(1, $this->countRows('detail_jurnal'));
        $this->assertSame(1, $this->countRows('slip_gaji'));
        $this->assertSame(1, $this->countRows('detail_penggajian'));
        $this->assertSame(2, $this->countRows('jurnal'));
        $this->assertSame(1, $this->countRows('penggajian'));
        $this->assertSame(10, (int) $this->db->table('periode_gaji')->get()->getRowArray()['jurnal_pengakuan_id']);
        $this->assertSame(10, (int) $this->db->table('jurnal')->where('id', 11)->get()->getRowArray()['reversal_of']);
    }

    public function testBalanceAndLedgerReportsWorkWithNoJournals(): void
    {
        $command = $this->makeCommand();
        [$exitCode, $output] = $this->runWithOutput($command, ['force' => true], [$this->db->getDatabase()]);
        $this->assertSame(0, $exitCode, $output);

        $this->withRoutes([
            ['GET', 'neraca-saldo', 'Api\V1\NeracaSaldo::index'],
            ['GET', 'buku-besar', 'Api\V1\BukuBesar::index'],
        ]);

        $balanceResponse = $this->get('/neraca-saldo');
        $balanceResponse->assertOK();
        $balance = json_decode($balanceResponse->getJSON(), true);
        $this->assertSame([], $balance['data']['akun']);
        $this->assertSame(0, $balance['data']['total_debit']);
        $this->assertSame(0, $balance['data']['total_kredit']);
        $this->assertTrue($balance['data']['seimbang']);

        $ledgerResponse = $this->get('/buku-besar?akun_id=1');
        $ledgerResponse->assertOK();
        $ledger = json_decode($ledgerResponse->getJSON(), true);
        $this->assertSame([], $ledger['data']['mutasi']);
        $this->assertSame(0, $ledger['data']['total_debit']);
        $this->assertSame(0, $ledger['data']['total_kredit']);
        $this->assertSame(0, $ledger['data']['saldo_akhir']);
    }

    public function testPayrollJournalCanBeCreatedAfterResetAndNumbersStartAtOne(): void
    {
        $command = $this->makeCommand();
        [$exitCode, $output] = $this->runWithOutput($command, ['force' => true], [$this->db->getDatabase()]);
        $this->assertSame(0, $exitCode, $output);

        $this->db->table('periode_gaji')->insert([
            'id'            => 2,
            'dibuat_oleh'   => 1,
            'periode'       => '2026-11',
            'tanggal_tutup' => '2026-11-30',
        ]);
        $this->db->table('penggajian')->insert([
            'id'              => 2,
            'periode_gaji_id' => 2,
            'karyawan_id'     => 1,
            'gaji_bersih'     => '100.00',
        ]);
        $this->db->table('komponen_gaji')->insertBatch([
            ['id' => 2, 'kode' => 'PPH21'],
            ['id' => 3, 'kode' => 'BPJS'],
        ]);
        $this->db->table('detail_penggajian')->insertBatch([
            ['id' => 2, 'penggajian_id' => 2, 'komponen_id' => 2, 'tipe' => 'potongan', 'jumlah' => '10.00'],
            ['id' => 3, 'penggajian_id' => 2, 'komponen_id' => 3, 'tipe' => 'potongan', 'jumlah' => '5.00'],
        ]);

        $journalId = AccountingService::jurnalPengakuan(
            new SqliteJournalConnection($this->db),
            ['id' => 2, 'periode' => '2026-11', 'tanggal_tutup' => '2026-11-30'],
            1,
        );
        $journal = $this->db->table('jurnal')->where('id', $journalId)->get()->getRowArray();

        $this->assertSame(12, $journalId);
        $this->assertSame('JU/2026/11/0001', $journal['nomor_bukti']);
        $this->assertSame('100.00', number_format((float) $journal['total_debit'], 2, '.', ''));
        $this->assertSame('100.00', number_format((float) $journal['total_kredit'], 2, '.', ''));
        $this->assertSame(2, $this->db->table('detail_jurnal')->where('jurnal_id', $journalId)->countAllResults());
        $journalLines = $this->db->table('detail_jurnal')->where('jurnal_id', $journalId)->get()->getResultArray();
        $accountIds = array_map('intval', array_column($journalLines, 'akun_id'));
        sort($accountIds);
        $this->assertSame([2, 3], $accountIds);
    }

    private function makeCommand(?string $environment = null)
    {
        return new class(service('logger'), service('commands'), $environment) extends ResetPayroll {
            private ?string $environmentOverride;

            public function __construct($logger, $commands, ?string $environment)
            {
                parent::__construct($logger, $commands);
                $this->environmentOverride = $environment;
            }

            protected function environment(): string
            {
                return $this->environmentOverride ?? parent::environment();
            }
        };
    }

    private function runWithOutput(ResetPayroll $command, array $params, array $inputs = []): array
    {
        $io = new MockInputOutput();
        $io->setInputs($inputs);
        CLI::setInputOutput($io);
        CLI::resetLastWrite();
        try {
            $exitCode = $command->run($params);
            $output   = $io->getOutput();
        } finally {
            CLI::resetInputOutput();
        }

        return [$exitCode, $output];
    }

    private function createSchema(): void
    {
        $schemas = [
            'users' => 'id INTEGER PRIMARY KEY',
            'karyawan' => 'id INTEGER PRIMARY KEY',
            'jabatan' => 'id INTEGER PRIMARY KEY',
            'departemen' => 'id INTEGER PRIMARY KEY',
            'akun' => "id INTEGER PRIMARY KEY, kode VARCHAR(10), nama VARCHAR(100), saldo_normal VARCHAR(10), aktif INTEGER",
            'komponen_gaji' => 'id INTEGER PRIMARY KEY, kode VARCHAR(30)',
            'karyawan_komponen' => 'id INTEGER PRIMARY KEY',
            'pengaturan' => '`key` VARCHAR(80) PRIMARY KEY',
            'jadwal_kerja' => 'id INTEGER PRIMARY KEY',
            'lokasi_absensi' => 'id INTEGER PRIMARY KEY',
            'hari_libur' => 'id INTEGER PRIMARY KEY',
            'kuota_cuti' => 'id INTEGER PRIMARY KEY',
            'refresh_tokens' => 'id INTEGER PRIMARY KEY',
            'periode_gaji' => 'id INTEGER PRIMARY KEY, dibuat_oleh INTEGER, jurnal_pengakuan_id INTEGER, jurnal_pembayaran_id INTEGER, periode VARCHAR(7), tanggal_tutup DATE, FOREIGN KEY (dibuat_oleh) REFERENCES ' . $this->db->prefixTable('users') . '(id), FOREIGN KEY (jurnal_pengakuan_id) REFERENCES ' . $this->db->prefixTable('jurnal') . '(id) ON DELETE RESTRICT, FOREIGN KEY (jurnal_pembayaran_id) REFERENCES ' . $this->db->prefixTable('jurnal') . '(id) ON DELETE RESTRICT',
            'jurnal' => 'id INTEGER PRIMARY KEY AUTOINCREMENT, nomor_bukti VARCHAR(30), tanggal DATE, keterangan VARCHAR(255), sumber VARCHAR(20), jenis VARCHAR(30), status VARCHAR(20), reversal_of INTEGER, periode_gaji_id INTEGER, total_debit DECIMAL(15,2), total_kredit DECIMAL(15,2), dibuat_oleh INTEGER, created_at DATETIME, updated_at DATETIME, FOREIGN KEY (periode_gaji_id) REFERENCES ' . $this->db->prefixTable('periode_gaji') . '(id) ON DELETE RESTRICT, FOREIGN KEY (reversal_of) REFERENCES ' . $this->db->prefixTable('jurnal') . '(id) ON DELETE RESTRICT',
            'periode_status_log' => 'id INTEGER PRIMARY KEY, periode_gaji_id INTEGER, oleh INTEGER, FOREIGN KEY (periode_gaji_id) REFERENCES ' . $this->db->prefixTable('periode_gaji') . '(id) ON DELETE CASCADE, FOREIGN KEY (oleh) REFERENCES ' . $this->db->prefixTable('users') . '(id) ON DELETE RESTRICT',
            'penggajian' => 'id INTEGER PRIMARY KEY, periode_gaji_id INTEGER, karyawan_id INTEGER, gaji_bersih DECIMAL(15,2), FOREIGN KEY (periode_gaji_id) REFERENCES ' . $this->db->prefixTable('periode_gaji') . '(id) ON DELETE CASCADE, FOREIGN KEY (karyawan_id) REFERENCES ' . $this->db->prefixTable('karyawan') . '(id) ON DELETE RESTRICT',
            'detail_penggajian' => 'id INTEGER PRIMARY KEY, penggajian_id INTEGER, komponen_id INTEGER, tipe VARCHAR(20), jumlah DECIMAL(15,2), FOREIGN KEY (penggajian_id) REFERENCES ' . $this->db->prefixTable('penggajian') . '(id) ON DELETE CASCADE, FOREIGN KEY (komponen_id) REFERENCES ' . $this->db->prefixTable('komponen_gaji') . '(id) ON DELETE RESTRICT',
            'slip_gaji' => 'id INTEGER PRIMARY KEY, penggajian_id INTEGER, FOREIGN KEY (penggajian_id) REFERENCES ' . $this->db->prefixTable('penggajian') . '(id) ON DELETE RESTRICT',
            'detail_jurnal' => 'id INTEGER PRIMARY KEY AUTOINCREMENT, jurnal_id INTEGER, akun_id INTEGER, debit DECIMAL(15,2), kredit DECIMAL(15,2), urutan INTEGER, FOREIGN KEY (jurnal_id) REFERENCES ' . $this->db->prefixTable('jurnal') . '(id) ON DELETE CASCADE, FOREIGN KEY (akun_id) REFERENCES ' . $this->db->prefixTable('akun') . '(id) ON DELETE RESTRICT',
            'pengajuan_izin' => 'id INTEGER PRIMARY KEY, karyawan_id INTEGER, diproses_oleh INTEGER, FOREIGN KEY (karyawan_id) REFERENCES ' . $this->db->prefixTable('karyawan') . '(id) ON DELETE RESTRICT, FOREIGN KEY (diproses_oleh) REFERENCES ' . $this->db->prefixTable('users') . '(id) ON DELETE RESTRICT',
            'absensi' => 'id INTEGER PRIMARY KEY, karyawan_id INTEGER, lokasi_absensi_id INTEGER, pengajuan_id INTEGER, FOREIGN KEY (karyawan_id) REFERENCES ' . $this->db->prefixTable('karyawan') . '(id) ON DELETE RESTRICT, FOREIGN KEY (lokasi_absensi_id) REFERENCES ' . $this->db->prefixTable('lokasi_absensi') . '(id) ON DELETE RESTRICT, FOREIGN KEY (pengajuan_id) REFERENCES ' . $this->db->prefixTable('pengajuan_izin') . '(id) ON DELETE RESTRICT',
        ];

        foreach ($schemas as $table => $schema) {
            $this->db->query('CREATE TABLE ' . $this->db->prefixTable($table) . ' (' . $schema . ')');
        }
    }

    private function seedData(): void
    {
        foreach ($this->masterTables as $table) {
            if ($table === 'pengaturan') {
                $data = ['key' => 'sample'];
            } else {
                $data = ['id' => 1];
            }
            if ($table === 'akun') {
                $data += ['kode' => '1-1100', 'nama' => 'Kas/Bank', 'saldo_normal' => 'debit', 'aktif' => 1];
            }
            if ($table === 'komponen_gaji') {
                $data += ['kode' => 'POT-OTHER'];
            }
            $this->db->table($table)->insert($data);
        }
        $this->db->table('akun')->insertBatch([
            ['id' => 2, 'kode' => '2-1100', 'nama' => 'Utang Gaji', 'saldo_normal' => 'kredit', 'aktif' => 1],
            ['id' => 3, 'kode' => '5-1100', 'nama' => 'Beban Gaji', 'saldo_normal' => 'debit', 'aktif' => 1],
        ]);

        $this->db->table('periode_gaji')->insert([
            'id'            => 1,
            'dibuat_oleh'   => 1,
            'periode'       => '2026-10',
            'tanggal_tutup' => '2026-10-31',
        ]);
        $this->db->table('penggajian')->insert(['id' => 1, 'periode_gaji_id' => 1, 'karyawan_id' => 1, 'gaji_bersih' => '100.00']);
        $this->db->table('detail_penggajian')->insert(['id' => 1, 'penggajian_id' => 1, 'komponen_id' => 1, 'tipe' => 'potongan', 'jumlah' => '0.00']);
        $this->db->table('slip_gaji')->insert(['id' => 1, 'penggajian_id' => 1]);
        $this->db->table('periode_status_log')->insert(['id' => 1, 'periode_gaji_id' => 1, 'oleh' => 1]);
        $this->db->table('jurnal')->insert([
            'id'             => 10,
            'nomor_bukti'    => 'JU/2026/11/0001',
            'tanggal'        => '2026-11-01',
            'keterangan'     => 'Pengakuan gaji',
            'status'         => 'aktif',
            'reversal_of'    => null,
            'periode_gaji_id' => 1,
        ]);
        $this->db->table('jurnal')->insert([
            'id'              => 11,
            'nomor_bukti'     => 'JU/2026/11/0002',
            'tanggal'         => '2026-11-02',
            'keterangan'      => 'Pembalik',
            'status'          => 'aktif',
            'reversal_of'     => 10,
            'periode_gaji_id' => 1,
        ]);
        $this->db->table('periode_gaji')->where('id', 1)->update([
            'jurnal_pengakuan_id'  => 10,
            'jurnal_pembayaran_id' => 11,
        ]);
        $this->db->table('detail_jurnal')->insert(['id' => 1, 'jurnal_id' => 10, 'akun_id' => 1, 'debit' => 100, 'kredit' => 0]);
        $this->db->table('pengajuan_izin')->insert(['id' => 1, 'karyawan_id' => 1, 'diproses_oleh' => 1]);
        $this->db->table('absensi')->insert(['id' => 1, 'karyawan_id' => 1, 'lokasi_absensi_id' => 1, 'pengajuan_id' => 1]);
    }

    private function dropSchema(): void
    {
        $this->db->query('PRAGMA foreign_keys = OFF');
        $this->db->query('DROP TRIGGER IF EXISTS ' . $this->db->prefixTable('fail_jurnal_delete'));
        foreach (array_reverse(array_merge($this->masterTables, $this->transactionTables, $this->attendanceTables)) as $table) {
            $this->db->query('DROP TABLE IF EXISTS ' . $this->db->prefixTable($table));
        }
        $this->db->query('PRAGMA foreign_keys = ON');
    }

    private function countRows(string $table): int
    {
        return $this->db->table($table)->countAllResults();
    }

    private function masterSnapshot(): array
    {
        $snapshot = [];
        foreach ($this->masterTables as $table) {
            $rows = $this->db->table($table)->get()->getResultArray();
            usort($rows, static fn (array $a, array $b): int => strcmp(
                (string) ($a['id'] ?? $a['key'] ?? ''),
                (string) ($b['id'] ?? $b['key'] ?? ''),
            ));
            $snapshot[$table] = $rows;
        }

        return $snapshot;
    }
}

final class SqliteJournalConnection
{
    public function __construct(private $db)
    {
    }

    public function query(string $sql, array $binds = [])
    {
        // SQLite does not support the MySQL row-lock clause used by production.
        $sql = str_replace(' FROM jurnal ', ' FROM ' . $this->db->prefixTable('jurnal') . ' ', $sql);

        return $this->db->query(str_replace(' FOR UPDATE', '', $sql), $binds);
    }

    public function table(string $table)
    {
        return $this->db->table($table);
    }

    public function insertID(): int
    {
        return (int) $this->db->insertID();
    }
}
