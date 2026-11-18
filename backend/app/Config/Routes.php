<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');

$routes->get('test-db', 'TestKoneksi::index');
$routes->get('test-aiven', 'TestAiven::index');

// === API HADIRPAY ===
$routes->options('(:any)', static fn () => '');

$routes->group('api/v1', ['namespace' => 'App\Controllers\Api\V1'], static function ($routes) {
    $routes->get('ping', 'Ping::index');

    // publik
    $routes->post('auth/login', 'Auth::login');
    $routes->post('auth/refresh', 'Auth::refresh');

    // butuh token
    $routes->group('', ['namespace' => 'App\Controllers\Api\V1', 'filter' => 'auth'], static function ($routes) {
        $routes->post('auth/logout', 'Auth::logout');
        $routes->get('auth/me', 'Auth::me');
        $routes->put('auth/password', 'Auth::password');

        // ---- BACA: semua user login boleh ----
        $routes->get('departemen', 'Departemen::index');
        $routes->get('departemen/(:num)', 'Departemen::show/$1');

        $routes->get('jabatan', 'Jabatan::index');
        $routes->get('jabatan/(:num)', 'Jabatan::show/$1');

        // lokasi, jadwal, dan hari libur dibaca karyawan untuk halaman absen
        $routes->get('lokasi-absensi', 'LokasiAbsensi::index');
        $routes->get('lokasi-absensi/(:num)', 'LokasiAbsensi::show/$1');
        $routes->get('jadwal-kerja', 'JadwalKerja::index');
        $routes->get('jadwal-kerja/(:num)', 'JadwalKerja::show/$1');
        $routes->get('hari-libur', 'HariLibur::index');
        $routes->get('hari-libur/(:num)', 'HariLibur::show/$1');

        // ---- ABSENSI sisi karyawan: semua user login yang punya karyawan_id ----
        $routes->get('absensi/hari-ini', 'Absensi::hariIni');
        $routes->post('absensi/check-in', 'Absensi::checkIn');
        $routes->post('absensi/check-out', 'Absensi::checkOut');
        $routes->get('absensi/riwayat', 'Absensi::riwayat');

        // ---- TULIS: hanya admin_hrd ----
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd']], static function ($routes) {
            $routes->post('departemen', 'Departemen::create');
            $routes->put('departemen/(:num)', 'Departemen::update/$1');
            $routes->delete('departemen/(:num)', 'Departemen::delete/$1');

            $routes->post('jabatan', 'Jabatan::create');
            $routes->put('jabatan/(:num)', 'Jabatan::update/$1');
            $routes->delete('jabatan/(:num)', 'Jabatan::delete/$1');

            // karyawan berisi data gaji, jadi semuanya khusus admin_hrd
            $routes->get('karyawan', 'Karyawan::index');
            $routes->get('karyawan/(:num)', 'Karyawan::show/$1');
            $routes->post('karyawan', 'Karyawan::create');
            $routes->put('karyawan/(:num)', 'Karyawan::update/$1');
            $routes->delete('karyawan/(:num)', 'Karyawan::delete/$1');

            $routes->post('lokasi-absensi', 'LokasiAbsensi::create');
            $routes->put('lokasi-absensi/(:num)', 'LokasiAbsensi::update/$1');
            $routes->delete('lokasi-absensi/(:num)', 'LokasiAbsensi::delete/$1');

            $routes->post('jadwal-kerja', 'JadwalKerja::create');
            $routes->put('jadwal-kerja/(:num)', 'JadwalKerja::update/$1');
            $routes->delete('jadwal-kerja/(:num)', 'JadwalKerja::delete/$1');

            $routes->post('hari-libur', 'HariLibur::create');
            $routes->put('hari-libur/(:num)', 'HariLibur::update/$1');
            $routes->delete('hari-libur/(:num)', 'HariLibur::delete/$1');
        });
        $routes->group('absensi', ['namespace' => 'App\Controllers\Api\V1', 'filter' => 'auth'], static function ($routes) {
        $routes->get('hari-ini', 'Absensi::hariIni');
        $routes->post('check-in', 'Absensi::checkIn');
        $routes->post('check-out', 'Absensi::checkOut');
        $routes->get('riwayat', 'Absensi::riwayat');
    });
    });
});