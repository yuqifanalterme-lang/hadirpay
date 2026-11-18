<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run()
    {
        $now  = date('Y-m-d H:i:s');
        $hash = password_hash('Password123!', PASSWORD_DEFAULT);

        $rows = [];
        foreach ($this->db->table('karyawan')->orderBy('id')->get()->getResultArray() as $k) {
            $role = match ($k['email']) {
                'rina@hadirpay.test' => 'admin_hrd',
                'andi@hadirpay.test' => 'keuangan',
                default              => 'karyawan',
            };
            $rows[] = [
                'karyawan_id'   => $k['id'],
                'nama'          => $k['nama'],
                'email'         => $k['email'],
                'password_hash' => $hash,
                'role'          => $role,
                'aktif'         => 1,
                'created_at'    => $now,
                'updated_at'    => $now,
            ];
        }

        $rows[] = [
            'karyawan_id'   => null,
            'nama'          => 'Pemilik Demo',
            'email'         => 'pemilik@hadirpay.test',
            'password_hash' => $hash,
            'role'          => 'pemilik',
            'aktif'         => 1,
            'created_at'    => $now,
            'updated_at'    => $now,
        ];
        $this->db->table('users')->insertBatch($rows);
    }
}