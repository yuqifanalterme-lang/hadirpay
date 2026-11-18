<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        $this->call('DepartemenSeeder');
        $this->call('JabatanSeeder');
        $this->call('AkunSeeder');
        $this->call('KomponenGajiSeeder');
        $this->call('JadwalKerjaSeeder');
        $this->call('LokasiAbsensiSeeder');
    }
}