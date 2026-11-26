<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RemoveOvertimeSupport extends Migration
{
    public function up()
    {
        $allowanceComponent = $this->db->tableExists('komponen_gaji')
            ? $this->db->table('komponen_gaji')->select('id')->where('kode', 'TUN-TRANSPORT')->get()->getRowArray()
            : null;
        if ($this->db->tableExists('karyawan') && $this->db->tableExists('karyawan_komponen')
            && $this->db->fieldExists('tunjangan_tetap', 'karyawan') && $allowanceComponent) {
            $this->db->query(
                "INSERT INTO karyawan_komponen (karyawan_id, komponen_id, nilai, created_at, updated_at)
                 SELECT k.id, c.id, k.tunjangan_tetap, NOW(), NOW()
                 FROM karyawan k
                 JOIN komponen_gaji c ON c.kode = 'TUN-TRANSPORT'
                 WHERE k.tunjangan_tetap > 0
                   AND NOT EXISTS (
                       SELECT 1
                       FROM karyawan_komponen existing
                       WHERE existing.karyawan_id = k.id
                         AND existing.komponen_id = c.id
                   )"
            );
            $this->db->table('karyawan')->update(['tunjangan_tetap' => 0]);
        }

        if ($this->db->tableExists('pengajuan_izin')) {
            if ($this->db->tableExists('absensi') && $this->db->fieldExists('pengajuan_id', 'absensi')) {
                $this->db->query(
                    "UPDATE absensi a
                     JOIN pengajuan_izin p ON p.id = a.pengajuan_id
                     SET a.pengajuan_id = NULL
                     WHERE p.jenis = 'lembur'"
                );
            }
            if ($this->db->tableExists('notifikasi')) {
                $this->db->query(
                    "DELETE FROM notifikasi
                     WHERE LOWER(judul) LIKE '%lembur%'
                        OR LOWER(pesan) LIKE '%lembur%'"
                );
            }
            $this->db->table('pengajuan_izin')->where('jenis', 'lembur')->delete();
            $this->db->query(
                "ALTER TABLE pengajuan_izin MODIFY COLUMN jenis
                 ENUM('izin', 'sakit', 'cuti', 'koreksi_absensi') NOT NULL"
            );
        }

        if ($this->db->tableExists('absensi') && $this->db->fieldExists('lembur_menit', 'absensi')) {
            $this->db->table('absensi')->update(['lembur_menit' => 0]);
        }

        if ($this->db->tableExists('komponen_gaji')) {
            $this->db->table('komponen_gaji')->where('kode', 'LEMBUR')->update([
                'metode' => 'nominal_tetap',
                'nilai' => null,
                'aktif' => 0,
            ]);
            $this->db->query(
                "ALTER TABLE komponen_gaji MODIFY COLUMN metode
                 ENUM('nominal_tetap', 'persen', 'per_hari', 'per_menit') NOT NULL"
            );
        }
    }

    public function down()
    {
        if ($this->db->tableExists('pengajuan_izin')) {
            $this->db->query(
                "ALTER TABLE pengajuan_izin MODIFY COLUMN jenis
                 ENUM('izin', 'sakit', 'cuti', 'koreksi_absensi', 'lembur') NOT NULL"
            );
        }
        if ($this->db->tableExists('komponen_gaji')) {
            $this->db->query(
                "ALTER TABLE komponen_gaji MODIFY COLUMN metode
                 ENUM('nominal_tetap', 'persen', 'per_hari', 'per_jam', 'per_menit') NOT NULL"
            );
        }
    }
}
