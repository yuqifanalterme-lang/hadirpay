<?php

use App\Services\PayrollJournalCleanup;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

final class PayrollJournalCleanupTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $migrate = false;
    protected $refresh = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->db->query('DROP TABLE IF EXISTS ' . $this->db->prefixTable('jurnal'));
        $this->db->query('DROP TABLE IF EXISTS ' . $this->db->prefixTable('periode_gaji'));
        $this->db->query(
            'CREATE TABLE ' . $this->db->prefixTable('periode_gaji')
            . ' (id INTEGER PRIMARY KEY, jurnal_pengakuan_id INTEGER, jurnal_pembayaran_id INTEGER)'
        );
        $this->db->query(
            'CREATE TABLE ' . $this->db->prefixTable('jurnal')
            . ' (id INTEGER PRIMARY KEY, periode_gaji_id INTEGER, reversal_of INTEGER, sumber VARCHAR(20))'
        );
    }

    protected function tearDown(): void
    {
        $this->db->query('DROP TABLE IF EXISTS ' . $this->db->prefixTable('jurnal'));
        $this->db->query('DROP TABLE IF EXISTS ' . $this->db->prefixTable('periode_gaji'));
        parent::tearDown();
    }

    public function testRemovesAutomaticallyLinkedJournalsAndAllTheirReversals(): void
    {
        $this->db->table('periode_gaji')->insert([
            'id' => 1,
            'jurnal_pengakuan_id' => 10,
            'jurnal_pembayaran_id' => 11,
        ]);
        $this->db->table('jurnal')->insertBatch([
            ['id' => 10, 'periode_gaji_id' => null, 'reversal_of' => null, 'sumber' => 'otomatis'],
            ['id' => 11, 'periode_gaji_id' => 1, 'reversal_of' => null, 'sumber' => 'otomatis'],
            ['id' => 12, 'periode_gaji_id' => null, 'reversal_of' => 10, 'sumber' => 'otomatis'],
            ['id' => 13, 'periode_gaji_id' => null, 'reversal_of' => 12, 'sumber' => 'otomatis'],
            ['id' => 14, 'periode_gaji_id' => 1, 'reversal_of' => null, 'sumber' => 'manual'],
            ['id' => 15, 'periode_gaji_id' => 2, 'reversal_of' => null, 'sumber' => 'otomatis'],
        ]);

        PayrollJournalCleanup::hapusJurnalOtomatisTerkait($this->db, [
            'id' => 1,
            'jurnal_pengakuan_id' => 10,
            'jurnal_pembayaran_id' => 11,
        ]);

        $remainingIds = array_map('intval', array_column(
            $this->db->table('jurnal')->select('id')->orderBy('id')->get()->getResultArray(),
            'id'
        ));
        $period = $this->db->table('periode_gaji')->where('id', 1)->get()->getRowArray();

        $this->assertSame([14, 15], $remainingIds);
        $this->assertNull($period['jurnal_pengakuan_id']);
        $this->assertNull($period['jurnal_pembayaran_id']);
    }
}
