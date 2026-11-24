<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPayrollCancellation extends Migration
{
    public function up()
    {
        $this->db->query(
            "ALTER TABLE periode_gaji MODIFY COLUMN status
             ENUM('draft', 'menunggu_validasi', 'disetujui', 'dibayar', 'dibatalkan')
             NOT NULL DEFAULT 'draft'"
        );
        $this->db->query(
            "ALTER TABLE periode_status_log MODIFY COLUMN status
             ENUM('draft', 'menunggu_validasi', 'disetujui', 'dibayar', 'dibatalkan')
             NOT NULL"
        );

        if (! $this->db->fieldExists('ditutup', 'periode_gaji')) {
            $this->forge->addColumn('periode_gaji', [
                'ditutup' => ['type' => 'TINYINT', 'constraint' => 1, 'unsigned' => true, 'default' => 0],
            ]);
        }

        if (! $this->db->fieldExists('reversal_of', 'jurnal')) {
            $this->forge->addColumn('jurnal', [
                'reversal_of' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            ]);
            $this->db->query(
                'ALTER TABLE jurnal
                 ADD CONSTRAINT fk_jurnal_reversal_of
                 FOREIGN KEY (reversal_of) REFERENCES jurnal(id)
                 ON DELETE RESTRICT ON UPDATE RESTRICT'
            );
        }

        if (! $this->db->fieldExists('cancel_reason', 'jurnal')) {
            $this->forge->addColumn('jurnal', [
                'cancel_reason' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            ]);
            $this->db->query(
                'UPDATE jurnal SET cancel_reason = alasan_pembatalan
                 WHERE cancel_reason IS NULL AND alasan_pembatalan IS NOT NULL'
            );
        }

        if (! $this->db->fieldExists('cancelled_by', 'jurnal')) {
            $this->forge->addColumn('jurnal', [
                'cancelled_by' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            ]);
            $this->db->query(
                'UPDATE jurnal SET cancelled_by = dibatalkan_oleh
                 WHERE cancelled_by IS NULL AND dibatalkan_oleh IS NOT NULL'
            );
            $this->db->query(
                'ALTER TABLE jurnal
                 ADD CONSTRAINT fk_jurnal_cancelled_by
                 FOREIGN KEY (cancelled_by) REFERENCES users(id)
                 ON DELETE RESTRICT ON UPDATE RESTRICT'
            );
        }

        if (! $this->db->fieldExists('cancelled_at', 'jurnal')) {
            $this->forge->addColumn('jurnal', [
                'cancelled_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->db->query(
                'UPDATE jurnal SET cancelled_at = dibatalkan_pada
                 WHERE cancelled_at IS NULL AND dibatalkan_pada IS NOT NULL'
            );
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('cancelled_by', 'jurnal')) {
            $this->db->query('ALTER TABLE jurnal DROP FOREIGN KEY fk_jurnal_cancelled_by');
            $this->forge->dropColumn('jurnal', 'cancelled_by');
        }
        foreach (['cancel_reason', 'cancelled_at'] as $field) {
            if ($this->db->fieldExists($field, 'jurnal')) {
                $this->forge->dropColumn('jurnal', $field);
            }
        }

        if ($this->db->fieldExists('reversal_of', 'jurnal')) {
            $this->db->query('ALTER TABLE jurnal DROP FOREIGN KEY fk_jurnal_reversal_of');
            $this->forge->dropColumn('jurnal', 'reversal_of');
        }
        if ($this->db->fieldExists('ditutup', 'periode_gaji')) {
            $this->forge->dropColumn('periode_gaji', 'ditutup');
        }

        $hasCancelledPeriod = $this->db->table('periode_gaji')->where('status', 'dibatalkan')->countAllResults() > 0;
        $hasCancelledLog = $this->db->table('periode_status_log')->where('status', 'dibatalkan')->countAllResults() > 0;
        if (! $hasCancelledPeriod) {
            $this->db->query(
                "ALTER TABLE periode_gaji MODIFY COLUMN status
                 ENUM('draft', 'menunggu_validasi', 'disetujui', 'dibayar')
                 NOT NULL DEFAULT 'draft'"
            );
        }
        if (! $hasCancelledLog) {
            $this->db->query(
                "ALTER TABLE periode_status_log MODIFY COLUMN status
                 ENUM('draft', 'menunggu_validasi', 'disetujui', 'dibayar')
                 NOT NULL"
            );
        }
    }
}
