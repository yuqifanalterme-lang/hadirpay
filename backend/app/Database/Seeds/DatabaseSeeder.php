<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        $this->call('DepartemenSeeder');
        $this->call('JabatanSeeder');
        $this->call('PengaturanSeeder');
        $this->call('AkunSeeder');
        $this->call('KomponenGajiSeeder');
        $this->call('JadwalKerjaSeeder');
        $this->call('LokasiAbsensiSeeder');
        $this->call('HariLiburSeeder');
        $this->call('KaryawanSeeder');
        $this->call('UserSeeder');
        $this->call('KuotaCutiSeeder');
        $this->call('KaryawanKomponenSeeder');
        $this->call('PeriodePenggajianSeeder');
        $this->call('AbsensiDemoSeeder');
        $this->call('PengajuanDemoSeeder');
        $this->call('PenggajianOktoberSeeder');
        $this->call('NotifikasiSeeder');
    }
}