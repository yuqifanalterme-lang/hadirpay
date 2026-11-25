<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use RuntimeException;
use Throwable;

class BudiSantosoRecoverySeeder extends Seeder
{
    private const NAME = 'Budi Santoso';
    private const EMAIL = 'budi@hadirpay.test';

    public function run()
    {
        $db = $this->db;
        $db->transBegin();

        try {
            $department = $db->table('departemen')->where('nama', 'Gudang')->get()->getRowArray();
            $position   = $db->table('jabatan')->where('nama', 'Staf Gudang')->get()->getRowArray();
            $bpjs       = $db->table('komponen_gaji')->where('kode', 'BPJS')->get()->getRowArray();
            $pph21      = $db->table('komponen_gaji')->where('kode', 'PPH21')->get()->getRowArray();

            if (! $department || ! $position) {
                throw new RuntimeException('Departemen Gudang atau jabatan Staf Gudang belum tersedia.');
            }
            if (! $bpjs || ! (int) $bpjs['aktif'] || $bpjs['metode'] !== 'persen' || (float) $bpjs['nilai'] !== 3.0) {
                throw new RuntimeException('Komponen BPJS aktif dengan metode persen dan nilai 3 belum tersedia.');
            }
            $pph21Ready = $pph21
                && (int) $pph21['aktif']
                && $pph21['metode'] === 'nominal_tetap';

            $employee = $db->table('karyawan')->where('email', self::EMAIL)->get()->getRowArray();
            if ($employee && $employee['nama'] !== self::NAME) {
                throw new RuntimeException('Email Budi sudah dipakai oleh data karyawan lain.');
            }
            if ($employee && $employee['status'] !== 'aktif') {
                throw new RuntimeException('Data karyawan Budi sudah ada tetapi berstatus nonaktif.');
            }

            if (! $employee) {
                if ($db->table('users')->where('email', self::EMAIL)->countAllResults() > 0) {
                    throw new RuntimeException('Email Budi sudah dipakai oleh akun yang belum terhubung.');
                }

                $now = date('Y-m-d H:i:s');
                $db->table('karyawan')->insert([
                    'kode'             => $this->nextEmployeeCode(),
                    'nama'             => self::NAME,
                    'email'            => self::EMAIL,
                    'no_hp'            => null,
                    'departemen_id'    => (int) $department['id'],
                    'jabatan_id'       => (int) $position['id'],
                    'tanggal_mulai'    => '2022-04-22',
                    'jenis_penggajian' => 'bulanan',
                    'gaji_pokok'       => 4500000,
                    'tunjangan_tetap'  => 0,
                    'npwp'             => null,
                    'no_bpjs'          => null,
                    'status'           => 'aktif',
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ]);
                $employeeId = (int) $db->insertID();
            } else {
                $employeeId = (int) $employee['id'];
            }

            $user = $db->table('users')->where('email', self::EMAIL)->get()->getRowArray();
            if ($user && (int) $user['karyawan_id'] !== $employeeId) {
                throw new RuntimeException('Akun Budi sudah terhubung ke data karyawan lain.');
            }

            $userForEmployee = $db->table('users')->where('karyawan_id', $employeeId)->get()->getRowArray();
            if ($userForEmployee && (! $user || (int) $userForEmployee['id'] !== (int) $user['id'])) {
                throw new RuntimeException('Data Budi sudah terhubung ke akun pengguna lain.');
            }

            if (! $user) {
                $now = date('Y-m-d H:i:s');
                $db->table('users')->insert([
                    'karyawan_id'   => $employeeId,
                    'nama'          => self::NAME,
                    'email'         => self::EMAIL,
                    'password_hash' => password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
                    'role'          => 'karyawan',
                    'aktif'         => 1,
                    'created_at'    => $now,
                    'updated_at'    => $now,
                ]);
            } elseif ($user['nama'] !== self::NAME || $user['role'] !== 'karyawan' || ! (int) $user['aktif']) {
                throw new RuntimeException('Data akun Budi tidak sesuai dengan role karyawan.');
            }

            $this->ensureAssignment($employeeId, (int) $bpjs['id'], 3);
            if ($pph21Ready) {
                $this->ensureAssignment($employeeId, (int) $pph21['id'], 62000);
            }

            if (! $db->transStatus()) {
                throw new RuntimeException('Seeder pemulihan Budi gagal disimpan.');
            }

            $db->transCommit();
            echo 'Seeder pemulihan Budi selesai.' . PHP_EOL;
            if (! $pph21Ready) {
                echo 'PPh 21 ditunda: master production belum aktif dengan metode nominal tetap.' . PHP_EOL;
            }
        } catch (Throwable $e) {
            $db->transRollback();
            throw $e;
        }
    }

    private function nextEmployeeCode(): string
    {
        $lastId = $this->db->table('karyawan')->selectMax('id', 'max_id')->get()->getRowArray();
        $nextId = (int) ($lastId['max_id'] ?? 0) + 1;

        do {
            $code = sprintf('KRY-%04d', $nextId++);
            $exists = $this->db->table('karyawan')->where('kode', $code)->countAllResults() > 0;
        } while ($exists);

        return $code;
    }

    private function ensureAssignment(int $employeeId, int $componentId, float $value): void
    {
        $existing = $this->db->table('karyawan_komponen')
            ->where('karyawan_id', $employeeId)
            ->where('komponen_id', $componentId)
            ->get()->getRowArray();

        if ($existing) {
            if ((float) $existing['nilai'] !== $value) {
                throw new RuntimeException('Nilai komponen payroll Budi tidak sesuai.');
            }
            return;
        }

        $now = date('Y-m-d H:i:s');
        $this->db->table('karyawan_komponen')->insert([
            'karyawan_id' => $employeeId,
            'komponen_id' => $componentId,
            'nilai'       => $value,
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);
    }
}
