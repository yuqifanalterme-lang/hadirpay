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

        // departemen: semua user login boleh baca
        $routes->get('departemen', 'Departemen::index');
        $routes->get('departemen/(:num)', 'Departemen::show/$1');

        // departemen: hanya admin_hrd boleh tulis
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd']], static function ($routes) {
            $routes->post('departemen', 'Departemen::create');
            $routes->put('departemen/(:num)', 'Departemen::update/$1');
            $routes->delete('departemen/(:num)', 'Departemen::delete/$1');
        });
                // jabatan: semua user login boleh baca
        $routes->get('jabatan', 'Jabatan::index');
        $routes->get('jabatan/(:num)', 'Jabatan::show/$1');

        // jabatan: hanya admin_hrd boleh tulis
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd']], static function ($routes) {
            $routes->post('jabatan', 'Jabatan::create');
            $routes->put('jabatan/(:num)', 'Jabatan::update/$1');
            $routes->delete('jabatan/(:num)', 'Jabatan::delete/$1');
        });
    });
});