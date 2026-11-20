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

        // ---- CUTI DAN IZIN sisi karyawan: semua user login yang punya karyawan_id ----
        $routes->get('kuota-cuti/saya', 'KuotaCuti::saya');
        $routes->get('pengajuan-izin/saya', 'PengajuanIzin::saya');
        $routes->post('pengajuan-izin', 'PengajuanIzin::create');
        $routes->get('pengajuan-izin/(:num)', 'PengajuanIzin::show/$1');
        $routes->put('pengajuan-izin/(:num)/batalkan', 'PengajuanIzin::batalkan/$1');

        // ---- NOTIFIKASI (milik sendiri) dan PENGATURAN (baca): semua user login ----
        $routes->get('notifikasi', 'Notifikasi::index');
        $routes->get('notifikasi/belum-dibaca', 'Notifikasi::jumlahBelumDibaca');
        $routes->put('notifikasi/dibaca-semua', 'Notifikasi::dibacaSemua');
        $routes->put('notifikasi/(:num)/dibaca', 'Notifikasi::dibaca/$1');
        $routes->get('pengaturan', 'Pengaturan::index');
        $routes->get('pengaturan/(:segment)', 'Pengaturan::show/$1');

        // ---- PAYROLL (mengikuti kontrak bagian 7) ----
        // slip gaji dan rincian gaji: controller memeriksa kepemilikan untuk karyawan biasa
        $routes->get('slip-gaji', 'SlipGaji::index');
        $routes->get('slip-gaji/saya', 'SlipGaji::saya');
        $routes->get('slip-gaji/(:num)', 'SlipGaji::show/$1');
        $routes->get('penggajian/(:num)', 'Penggajian::show/$1');

        // baca payroll dan akuntansi (kontrak bagian 7 dan 8): admin_hrd, keuangan, pemilik
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd,keuangan,pemilik']], static function ($routes) {
            $routes->get('periode-gaji', 'PeriodeGaji::index');
            $routes->get('periode-gaji/(:num)', 'PeriodeGaji::show/$1');
            $routes->get('periode-gaji/(:num)/penggajian', 'Penggajian::index/$1');

            $routes->get('akun', 'Akun::index');
            $routes->get('jurnal', 'Jurnal::index');
            $routes->get('jurnal/(:num)', 'Jurnal::show/$1');
            $routes->get('buku-besar', 'BukuBesar::index');
            $routes->get('neraca-saldo', 'NeracaSaldo::index');
        });

        // buat periode, hitung, ajukan validasi: admin_hrd
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd']], static function ($routes) {
            $routes->post('periode-gaji', 'PeriodeGaji::create');
            $routes->delete('periode-gaji/(:num)', 'PeriodeGaji::delete/$1');
            $routes->post('periode-gaji/(:num)/hitung', 'PeriodeGaji::hitung/$1');
            $routes->post('periode-gaji/(:num)/ajukan-validasi', 'PeriodeGaji::ajukanValidasi/$1');
        });

        // validasi, pembayaran, akun, dan jurnal: keuangan
        $routes->group('', ['filter' => ['auth', 'role:keuangan']], static function ($routes) {
            $routes->post('periode-gaji/(:num)/kembalikan', 'PeriodeGaji::kembalikan/$1');
            $routes->post('periode-gaji/(:num)/setujui', 'PeriodeGaji::setujui/$1');
            $routes->post('periode-gaji/(:num)/bayar', 'PeriodeGaji::bayar/$1');

            $routes->post('akun', 'Akun::create');
            $routes->put('akun/(:num)', 'Akun::update/$1');
            $routes->delete('akun/(:num)', 'Akun::delete/$1');

            $routes->post('jurnal', 'Jurnal::create');
            $routes->put('jurnal/(:num)', 'Jurnal::update/$1');
            $routes->delete('jurnal/(:num)', 'Jurnal::delete/$1');
        });

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
            // cuti dan izin: khusus admin_hrd
            $routes->get('kuota-cuti', 'KuotaCuti::index');
            $routes->put('kuota-cuti', 'KuotaCuti::simpan');
            $routes->get('pengajuan-izin', 'PengajuanIzin::index');
            $routes->put('pengajuan-izin/(:num)/setujui', 'PengajuanIzin::setujui/$1');
            $routes->put('pengajuan-izin/(:num)/tolak', 'PengajuanIzin::tolak/$1');
            // komponen gaji: khusus admin_hrd
            $routes->get('komponen-gaji', 'KomponenGaji::index');
            $routes->get('komponen-gaji/(:num)', 'KomponenGaji::show/$1');
            $routes->post('komponen-gaji', 'KomponenGaji::create');
            $routes->put('komponen-gaji/(:num)', 'KomponenGaji::update/$1');
            $routes->delete('komponen-gaji/(:num)', 'KomponenGaji::delete/$1');

            // komponen gaji per karyawan: khusus admin_hrd
            $routes->get('karyawan/(:num)/komponen', 'KaryawanKomponen::index/$1');
            $routes->post('karyawan/(:num)/komponen', 'KaryawanKomponen::create/$1');
            $routes->put('karyawan/(:num)/komponen/(:num)', 'KaryawanKomponen::update/$1/$2');
            $routes->delete('karyawan/(:num)/komponen/(:num)', 'KaryawanKomponen::delete/$1/$2');
            // notifikasi (kirim) dan pengaturan (tulis): khusus admin_hrd
            $routes->post('notifikasi', 'Notifikasi::create');
            $routes->put('pengaturan', 'Pengaturan::simpanMassal');
            $routes->put('pengaturan/(:segment)', 'Pengaturan::simpan/$1');
            $routes->delete('pengaturan/(:segment)', 'Pengaturan::delete/$1');
        });
    });
});