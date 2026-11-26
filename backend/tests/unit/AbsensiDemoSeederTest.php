<?php

use App\Database\Seeds\AbsensiDemoSeeder;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use Config\Database;

final class AbsensiDemoSeederTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $migrate = false;
    protected $refresh = false;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['absensi', 'karyawan', 'lokasi_absensi', 'hari_libur', 'jadwal_kerja'] as $table) {
            $this->db->query('DROP TABLE IF EXISTS ' . $this->db->prefixTable($table));
        }

        $this->db->query('CREATE TABLE ' . $this->db->prefixTable('jadwal_kerja') . ' (id INTEGER PRIMARY KEY, is_default INTEGER, hari_kerja TEXT)');
        $this->db->query('CREATE TABLE ' . $this->db->prefixTable('hari_libur') . ' (id INTEGER PRIMARY KEY, tanggal DATE)');
        $this->db->query('CREATE TABLE ' . $this->db->prefixTable('lokasi_absensi') . ' (id INTEGER PRIMARY KEY, aktif INTEGER)');
        $this->db->query('CREATE TABLE ' . $this->db->prefixTable('karyawan') . ' (id INTEGER PRIMARY KEY, status TEXT, tanggal_mulai DATE)');
        $this->db->query(
            'CREATE TABLE ' . $this->db->prefixTable('absensi')
            . ' (id INTEGER PRIMARY KEY AUTOINCREMENT, karyawan_id INTEGER, tanggal DATE, jam_masuk TIME, jam_pulang TIME,'
            . ' status TEXT, menit_terlambat INTEGER, durasi_menit INTEGER, lembur_menit INTEGER, dalam_radius INTEGER,'
            . ' lokasi_absensi_id INTEGER, sumber TEXT, created_at DATETIME, updated_at DATETIME, UNIQUE(karyawan_id, tanggal))'
        );
    }

    public function testSeedsThroughJanuaryWithoutOverwritingManualAttendance(): void
    {
        $this->db->table('jadwal_kerja')->insert([
            'id'         => 1,
            'is_default' => 1,
            'hari_kerja' => 'senin,selasa,rabu,kamis,jumat',
        ]);
        $this->db->table('hari_libur')->insert(['id' => 1, 'tanggal' => '2027-01-01']);
        $this->db->table('lokasi_absensi')->insert(['id' => 1, 'aktif' => 1]);
        $this->db->table('karyawan')->insertBatch([
            ['id' => 1, 'status' => 'aktif', 'tanggal_mulai' => '2026-11-01'],
            ['id' => 2, 'status' => 'nonaktif', 'tanggal_mulai' => '2026-11-01'],
        ]);
        $this->db->table('absensi')->insertBatch([
            ['id' => 1, 'karyawan_id' => 1, 'tanggal' => '2026-11-02', 'status' => 'izin', 'sumber' => 'web'],
            ['id' => 2, 'karyawan_id' => 1, 'tanggal' => '2026-11-03', 'status' => 'alpha', 'sumber' => 'sistem'],
        ]);

        $seeder = new AbsensiDemoSeeder(new Database(), $this->db);
        ob_start();
        $seeder->run();
        $output = ob_get_clean();

        $attendance = $this->db->table('absensi')->where('karyawan_id', 1)->orderBy('tanggal')->get()->getResultArray();
        $manual = $this->db->table('absensi')->where('id', 1)->get()->getRowArray();

        $this->assertCount(64, $attendance);
        $this->assertSame('2027-01-29', $attendance[array_key_last($attendance)]['tanggal']);
        $this->assertSame('izin', $manual['status']);
        $this->assertSame('web', $manual['sumber']);
        $this->assertSame(0, $this->db->table('absensi')->where('karyawan_id', 2)->countAllResults());
        $this->assertStringContainsString('1 diperbarui', $output);
        $this->assertStringContainsString('2026-11-01 sampai 2027-01-31', $output);
    }
}
