<?php

use App\Services\PayrollService;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

final class PayrollServiceTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $migrate = false;
    protected $refresh = false;

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
            ];
        }

        $absensi['2026-10-05']['status'] = 'alpha';
        $absensi['2026-10-09']['status'] = 'terlambat';
        $absensi['2026-10-09']['menit_terlambat'] = 20;
        $komponen = [
            1 => ['id' => 1, 'kode' => 'TUN-TRANSPORT', 'nama' => 'Tunjangan transport', 'tipe' => 'pendapatan', 'metode' => 'nominal_tetap', 'nilai' => 245000, 'aktif' => 1],
            3 => ['id' => 3, 'kode' => 'POT-ALPHA', 'nama' => 'Potongan alpha', 'tipe' => 'potongan', 'metode' => 'per_hari', 'nilai' => null, 'aktif' => 1],
            4 => ['id' => 4, 'kode' => 'POT-TELAT', 'nama' => 'Potongan Terlambat', 'tipe' => 'potongan', 'metode' => 'per_menit', 'nilai' => 1000, 'aktif' => 1],
            5 => ['id' => 5, 'kode' => 'BPJS', 'nama' => 'Iuran BPJS', 'tipe' => 'potongan', 'metode' => 'persen', 'nilai' => 3, 'aktif' => 1],
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
                'tunjangan_tetap' => 245000,
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
        $this->assertArrayNotHasKey('upah_lembur', $hasil['penggajian']);
        $this->assertSame(4745000.0, $hasil['penggajian']['total_pendapatan']);
        // Late deduction: 1 keterlambatan × Rp1.000 (global Pengaturan default) = Rp1.000
        // Alpha: 4.500.000 / 22 = 204.545,45  BPJS: 4.500.000 × 1% = 45.000  Pot-lain: 200.000
        // Total potongan: 204.545,45 + 1.000 + 45.000 + 200.000 = 450.545,45
        $this->assertSame(450545.45, $hasil['penggajian']['total_potongan']);
        $this->assertSame(4294454.55, $hasil['penggajian']['gaji_bersih']);
        $this->assertNotContains('Upah lembur', array_column($hasil['detail'], 'nama'));
        $this->assertContains('Potongan Terlambat', array_column($hasil['detail'], 'nama'));
        $bpjsRows = array_values(array_filter($hasil['detail'], static fn ($row) => $row['nama'] === 'Iuran BPJS'));
        $this->assertCount(1, $bpjsRows);
        $this->assertSame(45000.0, $bpjsRows[0]['jumlah']);
        $this->assertSame(204545.45, $hasil['penggajian']['tarif_harian']);
        $this->assertSame(
            $hasil['penggajian']['total_pendapatan'] - $hasil['penggajian']['total_potongan'],
            $hasil['penggajian']['gaji_bersih']
        );
    }

    public function testSubmittedCutiIsUnpaidAndDoesNotCountAsAlphaForMonthlyPayroll(): void
    {
        $service = new PayrollService();
        $days = ['2026-11-02', '2026-11-03', '2026-11-04'];
        $absensi = [];
        foreach ($days as $date) {
            $absensi[$date] = ['status' => 'hadir', 'menit_terlambat' => 0, 'durasi_menit' => 480];
        }
        $absensi['2026-11-03']['status'] = 'alpha';

        $hasil = $service->hitungKaryawan(
            [
                'id' => 1,
                'jenis_penggajian' => 'bulanan',
                'gaji_pokok' => 3000,
                'tunjangan_tetap' => 0,
                'tanggal_mulai' => '2026-01-01',
            ],
            $days,
            [],
            [],
            [],
            $absensi,
            [[
                'jenis' => 'cuti',
                'tanggal_mulai' => '2026-11-03',
                'tanggal_selesai' => '2026-11-03',
            ]],
            '2026-12-01'
        );

        $rekap = json_decode($hasil['penggajian']['rekap_json'], true);
        $this->assertSame(1, $rekap['cuti']);
        $this->assertSame(0, $rekap['alpha']);
        $this->assertSame(2000.0, $hasil['penggajian']['gaji_pokok']);
        $this->assertSame(0.0, $hasil['penggajian']['total_potongan']);
        $this->assertSame(2000.0, $hasil['penggajian']['gaji_bersih']);
    }

    public function testCutiIsNotPaidForDailyPayroll(): void
    {
        $service = new PayrollService();
        $hasil = $service->hitungKaryawan(
            [
                'id' => 1,
                'jenis_penggajian' => 'harian',
                'gaji_pokok' => 100000,
                'tunjangan_tetap' => 0,
                'tanggal_mulai' => '2026-01-01',
            ],
            ['2026-11-02', '2026-11-03'],
            [],
            [],
            [],
            [
                '2026-11-02' => ['status' => 'hadir', 'menit_terlambat' => 0, 'durasi_menit' => 480],
                '2026-11-03' => ['status' => 'alpha', 'menit_terlambat' => 0, 'durasi_menit' => null],
            ],
            [[
                'jenis' => 'cuti',
                'tanggal_mulai' => '2026-11-03',
                'tanggal_selesai' => '2026-11-03',
            ]],
            '2026-12-01'
        );

        $rekap = json_decode($hasil['penggajian']['rekap_json'], true);
        $this->assertSame(1, $rekap['cuti']);
        $this->assertSame(0, $rekap['alpha']);
        $this->assertSame(100000.0, $hasil['penggajian']['gaji_pokok']);
    }

    public function testPayrollRejectsDeductionsThatExceedEarnings(): void
    {
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Total potongan melebihi total pendapatan');

        (new PayrollService())->hitungKaryawan(
            [
                'id' => 1,
                'jenis_penggajian' => 'bulanan',
                'gaji_pokok' => 1000,
                'tunjangan_tetap' => 0,
                'tanggal_mulai' => '2026-01-01',
            ],
            ['2026-11-02'],
            [
                1 => ['id' => 1, 'kode' => 'POT-LAIN', 'nama' => 'Potongan lain', 'tipe' => 'potongan', 'metode' => 'nominal_tetap', 'nilai' => 0, 'aktif' => 1],
            ],
            [],
            [1 => 2000],
            ['2026-11-02' => ['status' => 'hadir', 'menit_terlambat' => 0, 'durasi_menit' => 480]],
            [],
            '2026-12-01'
        );
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

    public function testBpjsUsesMasterRateWithoutAlphaOrEmployeeAssignment(): void
    {
        $component = [
            'id' => 1,
            'kode' => 'BPJS',
            'nama' => 'Iuran BPJS',
            'tipe' => 'potongan',
            'metode' => 'persen',
            'nilai' => 3,
            'aktif' => 1,
        ];
        $hasil = (new PayrollService())->hitungKaryawan(
            [
                'id' => 1,
                'jenis_penggajian' => 'bulanan',
                'gaji_pokok' => 5000000,
                'tunjangan_tetap' => 500000,
                'tanggal_mulai' => '2020-01-01',
            ],
            ['2026-10-01'],
            [1 => $component],
            ['BPJS' => $component],
            [],
            ['2026-10-01' => ['status' => 'hadir', 'menit_terlambat' => 0]],
            [],
            '2026-10-02'
        );

        $this->assertSame(150000.0, $hasil['penggajian']['total_potongan']);
        $this->assertSame(5000000.0, $hasil['penggajian']['total_pendapatan']);
    }

    public function testEmployeeBpjsRateAndManualOvertimeDeductionAffectNetPay(): void
    {
        $bpjs = [
            'id' => 1,
            'kode' => 'BPJS',
            'nama' => 'Iuran BPJS',
            'tipe' => 'potongan',
            'metode' => 'persen',
            'nilai' => 3,
            'aktif' => 1,
        ];
        $overtime = [
            'id' => 2,
            'kode' => 'POT-LEMBUR',
            'nama' => 'Potongan lembur per periode',
            'tipe' => 'potongan',
            'metode' => 'nominal_tetap',
            'nilai' => 0,
            'aktif' => 1,
        ];
        $hasil = (new PayrollService())->hitungKaryawan(
            [
                'id' => 1,
                'jenis_penggajian' => 'bulanan',
                'gaji_pokok' => 5000000,
                'tunjangan_tetap' => 0,
                'tanggal_mulai' => '2020-01-01',
            ],
            ['2026-10-01'],
            [1 => $bpjs, 2 => $overtime],
            ['BPJS' => $bpjs, 'POT-LEMBUR' => $overtime],
            [1 => 2.5, 2 => 40000],
            ['2026-10-01' => ['status' => 'hadir', 'menit_terlambat' => 0]],
            [],
            '2026-10-02'
        );

        $this->assertSame(165000.0, $hasil['penggajian']['total_potongan']);
        $this->assertSame(4835000.0, $hasil['penggajian']['gaji_bersih']);
        $deductions = array_filter($hasil['detail'], static fn ($row) => $row['tipe'] === 'potongan');
        $deductionAmounts = array_column($deductions, 'jumlah', 'nama');
        $this->assertSame(125000.0, $deductionAmounts['Iuran BPJS']);
        $this->assertSame(40000.0, $deductionAmounts['Potongan lembur per periode']);
    }

    /**
     * STEP 2(a): Gaji Rp4.500.000, 22 hari kerja, 1 alpha, lembur manual Rp100.000,
     * telat Rp20.000/kejadian → gaji bersih Rp4.375.454,55
     */
    public function testStep2aScenarioGivesExpectedGajiBersih(): void
    {
        $service = new PayrollService();
        $hariKerja = [];
        $absensi   = [];
        for ($i = 1; $i <= 31; $i++) {
            $date = sprintf('2026-10-%02d', $i);
            $dt   = new DateTimeImmutable($date);
            if ((int) $dt->format('N') > 5) {
                continue;
            }
            $hariKerja[] = $date;
            $absensi[$date] = ['status' => 'hadir', 'menit_terlambat' => 0];
        }
        // 1 alpha (2026-10-05 is a Monday)
        $absensi['2026-10-05']['status'] = 'alpha';
        // 1 terlambat (2026-10-07)
        $absensi['2026-10-07']['status']           = 'terlambat';
        $absensi['2026-10-07']['menit_terlambat']  = 5;

        // Manual komponen: lembur Rp100.000
        $komponenManual = [
            [
                'komponen_id' => null,
                'kode'        => 'PEND-LEMBUR',
                'sumber'      => 'manual',
                'nama'        => 'Lembur Oktober',
                'tipe'        => 'pendapatan',
                'keterangan'  => 'Lembur proyek',
                'jumlah'      => 100000.0,
            ],
        ];

        $alphaComponent = [
            'id' => 10,
            'kode' => 'POT-ALPHA',
            'nama' => 'Potongan alpha',
            'tipe' => 'potongan',
            'metode' => 'per_hari',
            'nilai' => 300000,
            'aktif' => 1,
        ];
        $lateComponent = [
            'id' => 11,
            'kode' => 'POT-TELAT',
            'nama' => 'Potongan keterlambatan',
            'tipe' => 'potongan',
            'metode' => 'per_menit',
            'nilai' => 1000,
            'aktif' => 1,
        ];
        $hasil = $service->hitungKaryawan(
            [
                'id'                => 1,
                'jenis_penggajian'  => 'bulanan',
                'gaji_pokok'        => 4500000,
                'tunjangan_tetap'   => 0,
                'tanggal_mulai'     => '2020-01-01',
            ],
            $hariKerja,
            [10 => $alphaComponent, 11 => $lateComponent],
            ['POT-ALPHA' => $alphaComponent, 'POT-TELAT' => $lateComponent],
            [10 => ['nilai' => 300000], 11 => ['nilai' => 1000]],
            $absensi,
            [],
            '2026-11-01',
            $komponenManual,
            20000.0  // Rp20.000 per keterlambatan
        );

        $this->assertCount(22, $hariKerja);
        // total_pendapatan = gaji_pokok + lembur = 4.500.000 + 100.000 = 4.600.000
        $this->assertSame(4600000.0, $hasil['penggajian']['total_pendapatan']);
        // alpha = 4.500.000 / 22 = 204.545,45 (rounded to 2 decimals)
        $alphaAmount = round(4500000 / 22, 2);
        // late = 1 × 20.000 = 20.000
        // total_potongan = alpha + late = 204.545,45 + 20.000
        $expectedPot = round($alphaAmount + 20000, 2);
        $this->assertSame($expectedPot, $hasil['penggajian']['total_potongan']);
        // gaji_bersih = 4.600.000 - total_potongan
        $this->assertSame(
            round(4600000 - $expectedPot, 2),
            $hasil['penggajian']['gaji_bersih']
        );
        // Verify the expected value from the brief: Rp4.375.454,55
        $this->assertSame(4375454.55, $hasil['penggajian']['gaji_bersih']);
        // Lembur row appears in pendapatan
        $pendNama = array_column(
            array_filter($hasil['detail'], static fn ($r) => $r['tipe'] === 'pendapatan'),
            'nama'
        );
        $this->assertContains('Lembur Oktober', $pendNama);
        // Alpha reduces cost (not a liability)
        $potNama = array_column(
            array_filter($hasil['detail'], static fn ($r) => $r['tipe'] === 'potongan'),
            'nama'
        );
        $this->assertContains('Potongan alpha', $potNama);
    }

    /**
     * STEP 2(d): Manual components can only be edited while periode is Draf;
     * any other status must throw DomainException.
     */
    public function testSimpanKomponenManualThrowsWhenPeriodeIsNotDraft(): void
    {
        $db = db_connect();
        $periodeTable = $db->prefixTable('periode_gaji');
        $payrollTable = $db->prefixTable('penggajian');
        $detailTable = $db->prefixTable('detail_penggajian');

        $db->query('CREATE TABLE ' . $periodeTable . ' (id INTEGER PRIMARY KEY, status VARCHAR(40))');
        $db->query(
            'CREATE TABLE ' . $payrollTable . ' (id INTEGER PRIMARY KEY, periode_gaji_id INTEGER, '
            . 'gaji_pokok DECIMAL(15,2), tunjangan DECIMAL(15,2), total_pendapatan DECIMAL(15,2), '
            . 'total_potongan DECIMAL(15,2), gaji_bersih DECIMAL(15,2), updated_at DATETIME)'
        );
        $db->query(
            'CREATE TABLE ' . $detailTable . ' (id INTEGER PRIMARY KEY AUTOINCREMENT, penggajian_id INTEGER, '
            . 'komponen_id INTEGER, kode VARCHAR(50), sumber VARCHAR(20), nama VARCHAR(100), tipe VARCHAR(20), '
            . 'keterangan VARCHAR(150), jumlah DECIMAL(15,2), urutan INTEGER)'
        );

        try {
            $db->table('periode_gaji')->insert(['id' => 1, 'status' => 'draft']);
            $db->table('penggajian')->insert([
                'id' => 1,
                'periode_gaji_id' => 1,
                'gaji_pokok' => 1000,
                'tunjangan' => 0,
                'total_pendapatan' => 1000,
                'total_potongan' => 0,
                'gaji_bersih' => 1000,
            ]);
            $db->table('detail_penggajian')->insert([
                'penggajian_id' => 1,
                'kode' => 'GAJI-POKOK',
                'sumber' => 'otomatis',
                'nama' => 'Gaji pokok',
                'tipe' => 'pendapatan',
                'jumlah' => 1000,
                'urutan' => 1,
            ]);

            $service = new PayrollService();
            $service->simpanKomponenManual(1, [[
                'jenis' => 'lembur',
                'nama' => 'Pendapatan Lembur',
                'jumlah' => 100,
                'catatan' => 'Lembur hari kerja',
            ]]);
            $this->assertSame(1100.0, (float) $db->table('penggajian')->where('id', 1)->get()->getRowArray()['total_pendapatan']);

            foreach (['menunggu_validasi', 'disetujui', 'dibayar', 'dibatalkan'] as $status) {
                $db->table('periode_gaji')->where('id', 1)->update(['status' => $status]);
                try {
                    $service->simpanKomponenManual(1, [[
                        'jenis' => 'lembur',
                        'nama' => 'Pendapatan Lembur',
                        'jumlah' => 200,
                        'catatan' => 'Perubahan yang harus ditolak',
                    ]]);
                    $this->fail("Komponen manual tidak boleh disimpan saat status {$status}.");
                } catch (\DomainException $e) {
                    $this->assertStringContainsString('draft', strtolower($e->getMessage()));
                    $this->assertSame(1100.0, (float) $db->table('penggajian')->where('id', 1)->get()->getRowArray()['total_pendapatan']);
                }
            }
        } finally {
            $db->query('DROP TABLE IF EXISTS ' . $detailTable);
            $db->query('DROP TABLE IF EXISTS ' . $payrollTable);
            $db->query('DROP TABLE IF EXISTS ' . $periodeTable);
        }
    }

    /** STEP 2(c): A saved payroll detail remains unchanged after its master component changes. */
    public function testSnapshotIsImmutableAfterMasterKomponenChange(): void
    {
        $db = db_connect();
        $schemas = [
            'jadwal_kerja' => 'id INTEGER PRIMARY KEY, hari_kerja VARCHAR(100), is_default INTEGER',
            'hari_libur' => 'id INTEGER PRIMARY KEY, tanggal DATE',
            'karyawan' => 'id INTEGER PRIMARY KEY, status VARCHAR(20), tanggal_mulai DATE, jenis_penggajian VARCHAR(20), gaji_pokok DECIMAL(15,2), tunjangan_tetap DECIMAL(15,2)',
            'komponen_gaji' => 'id INTEGER PRIMARY KEY, kode VARCHAR(30), nama VARCHAR(100), tipe VARCHAR(20), metode VARCHAR(30), nilai DECIMAL(15,2), aktif INTEGER',
            'karyawan_komponen' => 'id INTEGER PRIMARY KEY, karyawan_id INTEGER, komponen_id INTEGER, nilai DECIMAL(15,2), metode_override VARCHAR(20)',
            'pengaturan' => '`key` VARCHAR(80) PRIMARY KEY, value_json TEXT',
            'periode_gaji' => 'id INTEGER PRIMARY KEY, status VARCHAR(30), tanggal_mulai DATE, tanggal_selesai DATE, dihitung_pada DATETIME, hari_kerja INTEGER, jumlah_karyawan INTEGER, total_pendapatan DECIMAL(15,2), total_potongan DECIMAL(15,2), total_gaji_bersih DECIMAL(15,2)',
            'penggajian' => 'id INTEGER PRIMARY KEY AUTOINCREMENT, periode_gaji_id INTEGER, karyawan_id INTEGER, gaji_pokok DECIMAL(15,2), tunjangan DECIMAL(15,2), total_pendapatan DECIMAL(15,2), total_potongan DECIMAL(15,2), gaji_bersih DECIMAL(15,2), tarif_harian DECIMAL(15,2), rekap_json TEXT, created_at DATETIME, updated_at DATETIME',
            'detail_penggajian' => 'id INTEGER PRIMARY KEY AUTOINCREMENT, penggajian_id INTEGER, komponen_id INTEGER, kode VARCHAR(50), sumber VARCHAR(20), nama VARCHAR(100), tipe VARCHAR(20), keterangan VARCHAR(150), jumlah DECIMAL(15,2), urutan INTEGER',
            'absensi' => 'id INTEGER PRIMARY KEY, karyawan_id INTEGER, tanggal DATE, status VARCHAR(20), menit_terlambat INTEGER',
            'pengajuan_izin' => 'id INTEGER PRIMARY KEY, karyawan_id INTEGER, jenis VARCHAR(20), status VARCHAR(20), tanggal_mulai DATE, tanggal_selesai DATE',
        ];
        $tables = array_keys($schemas);
        $tables = array_map([$db, 'prefixTable'], $tables);

        foreach (array_reverse($tables) as $table) {
            $db->query('DROP TABLE IF EXISTS ' . $table);
        }

        try {
            foreach ($schemas as $table => $schema) {
                $db->query('CREATE TABLE ' . $db->prefixTable($table) . ' (' . $schema . ')');
            }

            $workday = new DateTimeImmutable('yesterday');
            while ((int) $workday->format('N') > 5) {
                $workday = $workday->modify('-1 day');
            }
            $date = $workday->format('Y-m-d');
            $db->table('jadwal_kerja')->insert([
                'id' => 1,
                'hari_kerja' => 'senin,selasa,rabu,kamis,jumat',
                'is_default' => 1,
            ]);
            $db->table('karyawan')->insert([
                'id' => 1,
                'status' => 'aktif',
                'tanggal_mulai' => '2020-01-01',
                'jenis_penggajian' => 'bulanan',
                'gaji_pokok' => 5000000,
                'tunjangan_tetap' => 0,
            ]);
            $db->table('komponen_gaji')->insert([
                'id' => 1,
                'kode' => 'BPJS',
                'nama' => 'Iuran BPJS',
                'tipe' => 'potongan',
                'metode' => 'persen',
                'nilai' => 3,
                'aktif' => 1,
            ]);
            $db->table('pengaturan')->insert([
                'key' => 'kebijakan_gaji',
                'value_json' => json_encode(['potongan_terlambat_per_keterlambatan' => 1000]),
            ]);
            $db->table('periode_gaji')->insert([
                'id' => 1,
                'status' => 'draft',
                'tanggal_mulai' => $date,
                'tanggal_selesai' => $date,
            ]);
            $db->table('absensi')->insert([
                'id' => 1,
                'karyawan_id' => 1,
                'tanggal' => $date,
                'status' => 'hadir',
                'menit_terlambat' => 0,
            ]);

            $service = new PayrollService();
            $service->hitungPeriode([
                'id' => 1,
                'tanggal_mulai' => $date,
                'tanggal_selesai' => $date,
            ]);

            $payroll = $db->table('penggajian')->where('periode_gaji_id', 1)->get()->getRowArray();
            $snapshot = $db->table('detail_penggajian')
                ->where('penggajian_id', (int) $payroll['id'])
                ->where('kode', 'BPJS')
                ->get()->getRowArray();
            $this->assertNotNull($snapshot);
            $this->assertSame(150000.0, (float) $snapshot['jumlah']);
            $this->assertSame(150000.0, (float) $payroll['total_potongan']);

            $db->table('komponen_gaji')->where('id', 1)->update(['nilai' => 5]);

            $payrollAfterEdit = $db->table('penggajian')->where('id', (int) $payroll['id'])->get()->getRowArray();
            $snapshotAfterEdit = $db->table('detail_penggajian')
                ->where('id', (int) $snapshot['id'])
                ->get()->getRowArray();
            $this->assertSame(5.0, (float) $db->table('komponen_gaji')->where('id', 1)->get()->getRowArray()['nilai']);
            $this->assertSame(150000.0, (float) $payrollAfterEdit['total_potongan']);
            $this->assertSame(150000.0, (float) $snapshotAfterEdit['jumlah']);
        } finally {
            foreach (array_reverse($tables) as $table) {
                $db->query('DROP TABLE IF EXISTS ' . $table);
            }
            $db->resetTransStatus();
        }
    }
}
