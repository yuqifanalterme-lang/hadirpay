# Jalankan dari folder backend (yang ada file "spark"):
#   powershell -ExecutionPolicy Bypass -File .\setup_kontrak_2.ps1
# Tahap 2 penyelarasan dengan Kontrak API:
#  - Karyawan: list bersarang (jabatan{}, departemen{}, inisial), detail (komponen_gaji, sisa_cuti, role),
#    PUT sebagian, PATCH /karyawan/{id}/status, GET /karyawan/{id}/kehadiran-ringkas, tanpa DELETE
#  - Departemen dan Jabatan: jumlah_karyawan, parameter search, 409 CONFLICT
#  - Komponen gaji: PATCH /komponen-gaji/{id}/status, parameter search
#  - Pengaturan: lokasi_absensi ikut di GET, PUT boleh sebagian (tanpa pembungkus), baca khusus admin_hrd/keuangan/pemilik
# Semua teks ASCII.
$ErrorActionPreference = 'Stop'

if (-not (Test-Path .\spark)) {
    Write-Host "Jalankan skrip ini dari folder backend (yang ada file spark)." -ForegroundColor Red
    exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$ditulis = New-Object System.Collections.ArrayList

function Tulis($path, $isi) {
    $full = Join-Path (Get-Location).Path $path
    $dir  = Split-Path $full -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText($full, $isi, $utf8)
    [void]$ditulis.Add($path)
    Write-Host "dibuat: $path" -ForegroundColor Green
}

Copy-Item .\app\Config\Routes.php .\app\Config\Routes.php.bak7 -Force
Write-Host "Cadangan Routes.php: Routes.php.bak7 (hapus setelah semuanya lolos)" -ForegroundColor Yellow
foreach ($n in 'Karyawan','Departemen','Jabatan','Pengaturan') {
    $p = ".\app\Controllers\Api\V1\$n.php"
    if (Test-Path $p) { Copy-Item $p "$p.bak7" -Force }
}

# ================================================================
Tulis 'app\Config\Routes.php' @'
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

        // ---- kuota cuti sendiri ----
        $routes->get('kuota-cuti/saya', 'KuotaCuti::saya');

        // ---- NOTIFIKASI (milik sendiri): semua user login ----
        $routes->get('notifikasi', 'Notifikasi::index');
        $routes->patch('notifikasi/(:num)/baca', 'Notifikasi::baca/$1');
        $routes->post('notifikasi/baca-semua', 'Notifikasi::bacaSemua');

        // ---- PAYROLL (mengikuti kontrak bagian 7) ----
        // slip gaji dan rincian gaji: controller memeriksa kepemilikan untuk karyawan biasa
        $routes->get('slip-gaji', 'SlipGaji::index');
        $routes->get('slip-gaji/saya', 'SlipGaji::saya');
        $routes->get('slip-gaji/(:num)', 'SlipGaji::show/$1');
        $routes->get('penggajian/(:num)', 'Penggajian::show/$1');

        // ---- PENGAJUAN (kontrak bagian 6): admin_hrd (semua), karyawan dan keuangan (milik sendiri) ----
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd,karyawan,keuangan']], static function ($routes) {
            $routes->get('pengajuan', 'Pengajuan::index');
            $routes->get('pengajuan/kuota', 'Pengajuan::kuota');
            $routes->get('pengajuan/(:num)', 'Pengajuan::show/$1');
            $routes->get('pengajuan/(:num)/lampiran', 'Pengajuan::lampiran/$1');
            $routes->post('pengajuan', 'Pengajuan::create');
            $routes->delete('pengajuan/(:num)', 'Pengajuan::delete/$1');
        });

        // baca payroll, akuntansi, data karyawan, master, dan pengaturan: admin_hrd, keuangan, pemilik (kontrak bagian 4, 11, 12)
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd,keuangan,pemilik']], static function ($routes) {
            $routes->get('periode-gaji', 'PeriodeGaji::index');
            $routes->get('periode-gaji/(:num)', 'PeriodeGaji::show/$1');
            $routes->get('periode-gaji/(:num)/penggajian', 'Penggajian::index/$1');

            $routes->get('akun', 'Akun::index');
            $routes->get('jurnal', 'Jurnal::index');
            $routes->get('jurnal/(:num)', 'Jurnal::show/$1');
            $routes->get('buku-besar', 'BukuBesar::index');
            $routes->get('neraca-saldo', 'NeracaSaldo::index');

            // karyawan: admin_hrd tulis, keuangan dan pemilik hanya baca
            $routes->get('karyawan', 'Karyawan::index');
            $routes->get('karyawan/(:num)', 'Karyawan::show/$1');
            $routes->get('karyawan/(:num)/kehadiran-ringkas', 'Karyawan::kehadiranRingkas/$1'); // controller: admin_hrd dan pemilik

            $routes->get('departemen', 'Departemen::index');
            $routes->get('departemen/(:num)', 'Departemen::show/$1');
            $routes->get('jabatan', 'Jabatan::index');
            $routes->get('jabatan/(:num)', 'Jabatan::show/$1');

            $routes->get('pengaturan', 'Pengaturan::index');
            $routes->get('pengaturan/(:segment)', 'Pengaturan::show/$1');
        });

        // baca komponen gaji: admin_hrd dan keuangan
        $routes->group('', ['filter' => ['auth', 'role:admin_hrd,keuangan']], static function ($routes) {
            $routes->get('komponen-gaji', 'KomponenGaji::index');
            $routes->get('komponen-gaji/(:num)', 'KomponenGaji::show/$1');
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

            // karyawan: tidak ada DELETE (kontrak), nonaktifkan lewat PATCH status
            $routes->post('karyawan', 'Karyawan::create');
            $routes->put('karyawan/(:num)', 'Karyawan::update/$1');
            $routes->patch('karyawan/(:num)/status', 'Karyawan::status/$1');

            $routes->post('lokasi-absensi', 'LokasiAbsensi::create');
            $routes->put('lokasi-absensi/(:num)', 'LokasiAbsensi::update/$1');
            $routes->delete('lokasi-absensi/(:num)', 'LokasiAbsensi::delete/$1');

            $routes->post('jadwal-kerja', 'JadwalKerja::create');
            $routes->put('jadwal-kerja/(:num)', 'JadwalKerja::update/$1');
            $routes->delete('jadwal-kerja/(:num)', 'JadwalKerja::delete/$1');

            $routes->post('hari-libur', 'HariLibur::create');
            $routes->put('hari-libur/(:num)', 'HariLibur::update/$1');
            $routes->delete('hari-libur/(:num)', 'HariLibur::delete/$1');

            // kuota cuti: atur oleh admin_hrd
            $routes->get('kuota-cuti', 'KuotaCuti::index');
            $routes->put('kuota-cuti', 'KuotaCuti::simpan');

            // proses pengajuan: admin_hrd
            $routes->post('pengajuan/bulk-proses', 'Pengajuan::bulkProses');
            $routes->post('pengajuan/(:num)/setujui', 'Pengajuan::setujui/$1');
            $routes->post('pengajuan/(:num)/tolak', 'Pengajuan::tolak/$1');

            // komponen gaji: tulis khusus admin_hrd
            $routes->post('komponen-gaji', 'KomponenGaji::create');
            $routes->put('komponen-gaji/(:num)', 'KomponenGaji::update/$1');
            $routes->patch('komponen-gaji/(:num)/status', 'KomponenGaji::status/$1');
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
'@

# ================================================================
Tulis 'app\Controllers\Api\V1\Karyawan.php' @'
<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Models\KaryawanModel;
use App\Models\KuotaCutiModel;
use App\Services\PayrollService;

class Karyawan extends BaseController
{
    private const SORT = [
        'nama'          => 'karyawan.nama',
        'kode'          => 'karyawan.kode',
        'tanggal_mulai' => 'karyawan.tanggal_mulai',
        'status'        => 'karyawan.status',
    ];

    private KaryawanModel $model;

    public function __construct()
    {
        $this->model = new KaryawanModel();
    }

    private function relasi(): KaryawanModel
    {
        return $this->model
            ->select('karyawan.*, departemen.nama AS departemen_nama, jabatan.nama AS jabatan_nama, users.role AS akun_role')
            ->join('departemen', 'departemen.id = karyawan.departemen_id', 'left')
            ->join('jabatan', 'jabatan.id = karyawan.jabatan_id', 'left')
            ->join('users', 'users.karyawan_id = karyawan.id', 'left');
    }

    private static function inisial(string $nama): string
    {
        $kata = preg_split('/\s+/', trim($nama));
        return strtoupper(mb_substr($kata[0], 0, 1) . (isset($kata[1]) ? mb_substr($kata[1], 0, 1) : ''));
    }

    /** bentuk item list (kontrak bagian 4) */
    private function ringkas(array $r): array
    {
        return [
            'id'               => (int) $r['id'],
            'kode'             => $r['kode'],
            'nama'             => $r['nama'],
            'inisial'          => self::inisial($r['nama']),
            'jabatan'          => ['id' => (int) $r['jabatan_id'], 'nama' => $r['jabatan_nama']],
            'departemen'       => ['id' => (int) $r['departemen_id'], 'nama' => $r['departemen_nama']],
            'jenis_penggajian' => $r['jenis_penggajian'],
            'status'           => $r['status'],
            'tanggal_mulai'    => $r['tanggal_mulai'],
        ];
    }

    /** bentuk detail (kontrak bagian 4) */
    private function detail($id): ?array
    {
        $r = $this->relasi()->where('karyawan.id', $id)->first();
        if (! $r) {
            return null;
        }

        $komp = db_connect()->table('karyawan_komponen kk')
            ->select('kk.komponen_id, kg.nama, kg.tipe, kk.nilai')
            ->join('komponen_gaji kg', 'kg.id = kk.komponen_id')
            ->where('kk.karyawan_id', (int) $r['id'])
            ->orderBy('kg.tipe', 'ASC')->orderBy('kg.nama', 'ASC')
            ->get()->getResultArray();

        $kuota = (new KuotaCutiModel())->ambilAtauBuat((int) $r['id'], (int) date('Y'));

        return [
            'id'               => (int) $r['id'],
            'kode'             => $r['kode'],
            'nama'             => $r['nama'],
            'inisial'          => self::inisial($r['nama']),
            'email'            => $r['email'],
            'no_hp'            => $r['no_hp'],
            'jabatan_id'       => (int) $r['jabatan_id'],
            'departemen_id'    => (int) $r['departemen_id'],
            'jabatan'          => ['id' => (int) $r['jabatan_id'], 'nama' => $r['jabatan_nama']],
            'departemen'       => ['id' => (int) $r['departemen_id'], 'nama' => $r['departemen_nama']],
            'tanggal_mulai'    => $r['tanggal_mulai'],
            'jenis_penggajian' => $r['jenis_penggajian'],
            'gaji_pokok'       => (float) $r['gaji_pokok'],
            'tunjangan_tetap'  => (float) $r['tunjangan_tetap'],
            'npwp'             => $r['npwp'],
            'no_bpjs'          => $r['no_bpjs'],
            'status'           => $r['status'],
            'role'             => $r['akun_role'],
            'komponen_gaji'    => array_map(static fn ($k) => [
                'komponen_id' => (int) $k['komponen_id'],
                'nama'        => $k['nama'],
                'tipe'        => $k['tipe'],
                'nilai'       => (float) $k['nilai'],
            ], $komp),
            'sisa_cuti'        => (float) $kuota['total'] - (float) $kuota['terpakai'],
        ];
    }

    // GET /api/v1/karyawan?search=&departemen_id=&jabatan_id=&status=&jenis_penggajian=&page=&per_page=&sort=&order=
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) ($this->request->getGet('search') ?? $this->request->getGet('q')));
        $status  = (string) $this->request->getGet('status');
        $jenis   = (string) $this->request->getGet('jenis_penggajian');
        $deptId  = (int) ($this->request->getGet('departemen_id') ?? 0);
        $jabId   = (int) ($this->request->getGet('jabatan_id') ?? 0);
        $sort    = self::SORT[(string) $this->request->getGet('sort')] ?? 'karyawan.nama';
        $order   = strtolower((string) $this->request->getGet('order')) === 'desc' ? 'DESC' : 'ASC';

        $this->relasi();

        if ($q !== '') {
            $this->model->groupStart()
                ->like('karyawan.nama', $q)
                ->orLike('karyawan.kode', $q)
                ->orLike('karyawan.email', $q)
                ->groupEnd();
        }
        if (in_array($status, ['aktif', 'nonaktif'], true)) {
            $this->model->where('karyawan.status', $status);
        }
        if (in_array($jenis, ['bulanan', 'harian'], true)) {
            $this->model->where('karyawan.jenis_penggajian', $jenis);
        }
        if ($deptId > 0) {
            $this->model->where('karyawan.departemen_id', $deptId);
        }
        if ($jabId > 0) {
            $this->model->where('karyawan.jabatan_id', $jabId);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy($sort, $order)->orderBy('karyawan.id', 'ASC')
            ->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success(array_map(fn ($r) => $this->ringkas($r), $rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    public function show($id = null)
    {
        $row = $this->detail($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    // POST /api/v1/karyawan
    public function create()
    {
        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules(null), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }
        if ($err = $this->cekJabatan($input)) {
            return $err;
        }

        $data = $this->payload($input);
        $db   = db_connect();

        if (empty($data['kode'])) {
            $max          = (int) $db->table('karyawan')->selectMax('id')->get()->getRow()->id;
            $data['kode'] = sprintf('KRY-%04d', $max + 1);
        }

        $role = $input['role'] ?? 'karyawan';

        $db->transBegin();
        try {
            $id  = $this->model->insert($data, true);
            $now = date('Y-m-d H:i:s');
            $db->table('users')->insert([
                'karyawan_id'   => $id,
                'nama'          => $data['nama'],
                'email'         => $data['email'],
                'password_hash' => password_hash($input['password'], PASSWORD_DEFAULT),
                'role'          => $role,
                'aktif'         => $data['status'] === 'aktif' ? 1 : 0,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal simpan karyawan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan karyawan dan akun', null, 500);
        }

        return ApiResponse::success($this->detail($id), 'Karyawan dan akun dibuat', null, 201);
    }

    // PUT /api/v1/karyawan/(:num)   semua field opsional (kontrak bagian 4)
    public function update($id = null)
    {
        $lama = $this->model->find($id);
        if (! $lama) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $gabung = array_merge([
            'kode'             => $lama['kode'],
            'nama'             => $lama['nama'],
            'email'            => $lama['email'],
            'no_hp'            => $lama['no_hp'],
            'departemen_id'    => $lama['departemen_id'],
            'jabatan_id'       => $lama['jabatan_id'],
            'tanggal_mulai'    => $lama['tanggal_mulai'],
            'jenis_penggajian' => $lama['jenis_penggajian'],
            'gaji_pokok'       => $lama['gaji_pokok'],
            'tunjangan_tetap'  => $lama['tunjangan_tetap'],
            'npwp'             => $lama['npwp'],
            'no_bpjs'          => $lama['no_bpjs'],
            'status'           => $lama['status'],
        ], $input);

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());
        if (! $validation->run($gabung)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }
        if ($err = $this->cekJabatan($gabung)) {
            return $err;
        }

        $data = $this->payload($gabung);
        if (empty($data['kode'])) {
            $data['kode'] = $lama['kode'];
        }

        $db = db_connect();
        $db->transBegin();
        try {
            $this->model->update($id, $data);

            $akun = [
                'nama'       => $data['nama'],
                'email'      => $data['email'],
                'aktif'      => $data['status'] === 'aktif' ? 1 : 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ];
            if (! empty($input['role'])) {
                $akun['role'] = $input['role'];
            }
            if (! empty($input['password'])) {
                $akun['password_hash'] = password_hash($input['password'], PASSWORD_DEFAULT);
            }
            $db->table('users')->where('karyawan_id', (int) $id)->update($akun);

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal update karyawan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal memperbarui karyawan', null, 500);
        }

        return ApiResponse::success($this->detail($id), 'Karyawan diperbarui');
    }

    // PATCH /api/v1/karyawan/(:num)/status   body: {"status":"nonaktif"}
    public function status($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $in = $this->request->getJSON(true) ?? [];
        $st = (string) ($in['status'] ?? '');
        if (! in_array($st, ['aktif', 'nonaktif'], true)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['status' => 'Pilih aktif atau nonaktif'], 422);
        }

        $sendiri = (int) ((JwtService::$user ?? [])['karyawan_id'] ?? 0);
        if ($st === 'nonaktif' && $sendiri === (int) $id) {
            return ApiResponse::error('CONFLICT', 'Anda tidak bisa menonaktifkan akun sendiri', null, 409);
        }

        $db = db_connect();
        $db->transBegin();
        try {
            $this->model->update($id, ['status' => $st]);
            $db->table('users')->where('karyawan_id', (int) $id)->update([
                'aktif'      => $st === 'aktif' ? 1 : 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal ubah status karyawan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal mengubah status karyawan', null, 500);
        }

        return ApiResponse::success($this->detail($id), 'Status karyawan diperbarui');
    }

    // GET /api/v1/karyawan/(:num)/kehadiran-ringkas?periode=2026-11   (admin_hrd, pemilik)
    public function kehadiranRingkas($id = null)
    {
        $role = (JwtService::$user ?? [])['role'] ?? '';
        if (! in_array($role, ['admin_hrd', 'pemilik'], true)) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $periode = (string) ($this->request->getGet('periode') ?: date('Y-m'));
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periode)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['periode' => 'Periode harus berformat YYYY-MM'], 422);
        }

        $mulai = $periode . '-01';
        $akhir = date('Y-m-t', strtotime($mulai));

        $c = ['hadir' => 0, 'terlambat' => 0, 'izin' => 0, 'sakit' => 0, 'cuti' => 0, 'alpha' => 0];
        $rows = db_connect()->table('absensi')->select('status, COUNT(*) AS n', false)
            ->where('karyawan_id', (int) $id)
            ->where('tanggal >=', $mulai)->where('tanggal <=', $akhir)
            ->groupBy('status')->get()->getResultArray();
        foreach ($rows as $r) {
            if (isset($c[$r['status']])) {
                $c[$r['status']] = (int) $r['n'];
            }
        }

        return ApiResponse::success(['periode' => $periode, 'hari_kerja' => count((new PayrollService())->hariKerja($mulai, $akhir))] + $c);
    }

    // Jabatan harus milik departemen karyawan, atau jabatan lintas departemen (departemen_id kosong)
    private function cekJabatan(array $input)
    {
        $jab = db_connect()->table('jabatan')->where('id', (int) $input['jabatan_id'])->get()->getRowArray();

        if ($jab && $jab['departemen_id'] !== null && (int) $jab['departemen_id'] !== (int) $input['departemen_id']) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'jabatan_id' => 'Jabatan ini bukan milik departemen yang dipilih',
            ], 422);
        }
        return null;
    }

    private function payload(array $in): array
    {
        return [
            'kode'             => isset($in['kode']) ? trim((string) $in['kode']) : null,
            'nama'             => trim($in['nama']),
            'email'            => strtolower(trim($in['email'])),
            'no_hp'            => $in['no_hp'] ?? null,
            'departemen_id'    => (int) $in['departemen_id'],
            'jabatan_id'       => (int) $in['jabatan_id'],
            'tanggal_mulai'    => $in['tanggal_mulai'],
            'jenis_penggajian' => $in['jenis_penggajian'] ?? 'bulanan',
            'gaji_pokok'       => $in['gaji_pokok'] ?? 0,
            'tunjangan_tetap'  => $in['tunjangan_tetap'] ?? 0,
            'npwp'             => $in['npwp'] ?? null,
            'no_bpjs'          => $in['no_bpjs'] ?? null,
            'status'           => $in['status'] ?? 'aktif',
        ];
    }

    private function rules(?int $id): array
    {
        $ex      = $id === null ? '' : ',id,' . $id;
        $exUsers = $id === null ? '' : ',karyawan_id,' . $id;

        return [
            'kode'             => 'permit_empty|max_length[20]|is_unique[karyawan.kode' . $ex . ']',
            'nama'             => 'required|min_length[2]|max_length[150]',
            'email'            => 'required|valid_email|max_length[150]|is_unique[karyawan.email' . $ex . ']|is_unique[users.email' . $exUsers . ']',
            'no_hp'            => 'permit_empty|max_length[20]',
            'departemen_id'    => 'required|is_natural_no_zero|is_not_unique[departemen.id]',
            'jabatan_id'       => 'required|is_natural_no_zero|is_not_unique[jabatan.id]',
            'tanggal_mulai'    => 'required|valid_date[Y-m-d]',
            'jenis_penggajian' => 'permit_empty|in_list[bulanan,harian]',
            'gaji_pokok'       => 'permit_empty|numeric|greater_than_equal_to[0]',
            'tunjangan_tetap'  => 'permit_empty|numeric|greater_than_equal_to[0]',
            'npwp'             => 'permit_empty|max_length[25]',
            'no_bpjs'          => 'permit_empty|max_length[25]',
            'status'           => 'permit_empty|in_list[aktif,nonaktif]',
            'role'             => 'permit_empty|in_list[admin_hrd,karyawan,keuangan,pemilik]',
            'password'         => $id === null
                ? 'required|min_length[8]|max_length[72]'
                : 'permit_empty|min_length[8]|max_length[72]',
        ];
    }

    private function messages(): array
    {
        return [
            'kode'  => ['is_unique' => 'Kode karyawan sudah dipakai'],
            'nama'  => ['required' => 'Nama wajib diisi', 'min_length' => 'Nama minimal 2 karakter'],
            'email' => [
                'required'    => 'Email wajib diisi',
                'valid_email' => 'Format email tidak valid',
                'is_unique'   => 'Email sudah dipakai',
            ],
            'departemen_id' => [
                'required'      => 'Departemen wajib dipilih',
                'is_not_unique' => 'Departemen tidak ditemukan',
            ],
            'jabatan_id' => [
                'required'      => 'Jabatan wajib dipilih',
                'is_not_unique' => 'Jabatan tidak ditemukan',
            ],
            'tanggal_mulai' => [
                'required'   => 'Tanggal mulai wajib diisi',
                'valid_date' => 'Format tanggal harus YYYY-MM-DD',
            ],
            'jenis_penggajian' => ['in_list' => 'Pilih bulanan atau harian'],
            'status'           => ['in_list' => 'Pilih aktif atau nonaktif'],
            'role'             => ['in_list' => 'Role harus admin_hrd, karyawan, keuangan, atau pemilik'],
            'password'         => [
                'required'   => 'Password wajib diisi',
                'min_length' => 'Password minimal 8 karakter',
            ],
        ];
    }
}
'@

# ================================================================
Tulis 'app\Controllers\Api\V1\Departemen.php' @'
<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\DepartemenModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

class Departemen extends BaseController
{
    private const SELECT = 'departemen.*, (SELECT COUNT(*) FROM karyawan k WHERE k.departemen_id = departemen.id) AS jumlah_karyawan';

    private DepartemenModel $model;

    public function __construct()
    {
        $this->model = new DepartemenModel();
    }

    private function bentuk(array $r): array
    {
        return [
            'id'              => (int) $r['id'],
            'nama'            => $r['nama'],
            'jumlah_karyawan' => (int) ($r['jumlah_karyawan'] ?? 0),
        ];
    }

    private function ambil($id): ?array
    {
        $r = $this->model->select(self::SELECT, false)->where('departemen.id', $id)->first();
        return $r ? $this->bentuk($r) : null;
    }

    // GET /api/v1/departemen?search=&page=&per_page=
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) ($this->request->getGet('search') ?? $this->request->getGet('q')));

        if ($q !== '') {
            $this->model->like('departemen.nama', $q);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->select(self::SELECT, false)
            ->orderBy('departemen.nama', 'ASC')
            ->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success(array_map(fn ($r) => $this->bentuk($r), $rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    public function show($id = null)
    {
        $row = $this->ambil($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    public function create()
    {
        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules(null), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $id = $this->model->insert(['nama' => trim($input['nama'])], true);

        return ApiResponse::success($this->ambil($id), 'Departemen dibuat', null, 201);
    }

    public function update($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $this->model->update($id, ['nama' => trim($input['nama'])]);

        return ApiResponse::success($this->ambil($id), 'Departemen diperbarui');
    }

    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Departemen tidak ditemukan', null, 404);
        }

        try {
            $this->model->delete($id);
        } catch (DatabaseException $e) {
            return ApiResponse::error('CONFLICT', 'Departemen masih dipakai jabatan atau karyawan', null, 409);
        }

        return ApiResponse::success(null, 'Departemen dihapus');
    }

    private function rules(?int $id): array
    {
        $unique = $id === null ? 'is_unique[departemen.nama]' : 'is_unique[departemen.nama,id,' . $id . ']';
        return ['nama' => 'required|min_length[2]|max_length[100]|' . $unique];
    }

    private function messages(): array
    {
        return [
            'nama' => [
                'required'   => 'Nama departemen wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
                'max_length' => 'Nama maksimal 100 karakter',
                'is_unique'  => 'Nama departemen sudah dipakai',
            ],
        ];
    }
}
'@

# ================================================================
Tulis 'app\Controllers\Api\V1\Jabatan.php' @'
<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\JabatanModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

class Jabatan extends BaseController
{
    private const SELECT = 'jabatan.*, departemen.nama AS departemen_nama, (SELECT COUNT(*) FROM karyawan k WHERE k.jabatan_id = jabatan.id) AS jumlah_karyawan';

    private JabatanModel $model;

    public function __construct()
    {
        $this->model = new JabatanModel();
    }

    private function gabung(): JabatanModel
    {
        return $this->model->join('departemen', 'departemen.id = jabatan.departemen_id', 'left');
    }

    private function bentuk(array $r): array
    {
        return [
            'id'              => (int) $r['id'],
            'nama'            => $r['nama'],
            'jumlah_karyawan' => (int) ($r['jumlah_karyawan'] ?? 0),
            'departemen_id'   => $r['departemen_id'] === null ? null : (int) $r['departemen_id'],
            'departemen_nama' => $r['departemen_nama'] ?? null,
        ];
    }

    private function ambil($id): ?array
    {
        $r = $this->gabung()->select(self::SELECT, false)->where('jabatan.id', $id)->first();
        return $r ? $this->bentuk($r) : null;
    }

    // GET /api/v1/jabatan?search=&departemen_id=&page=&per_page=
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) ($this->request->getGet('search') ?? $this->request->getGet('q')));
        $deptId  = (int) ($this->request->getGet('departemen_id') ?? 0);

        $this->gabung();
        if ($q !== '') {
            $this->model->like('jabatan.nama', $q);
        }
        if ($deptId > 0) {
            $this->model->where('jabatan.departemen_id', $deptId);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->select(self::SELECT, false)
            ->orderBy('jabatan.nama', 'ASC')
            ->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success(array_map(fn ($r) => $this->bentuk($r), $rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    public function show($id = null)
    {
        $row = $this->ambil($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Jabatan tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    public function create()
    {
        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules(null), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $id = $this->model->insert([
            'nama'          => trim($input['nama']),
            'departemen_id' => empty($input['departemen_id']) ? null : (int) $input['departemen_id'],
        ], true);

        return ApiResponse::success($this->ambil($id), 'Jabatan dibuat', null, 201);
    }

    public function update($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Jabatan tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());
        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $this->model->update($id, [
            'nama'          => trim($input['nama']),
            'departemen_id' => empty($input['departemen_id']) ? null : (int) $input['departemen_id'],
        ]);

        return ApiResponse::success($this->ambil($id), 'Jabatan diperbarui');
    }

    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Jabatan tidak ditemukan', null, 404);
        }

        try {
            $this->model->delete($id);
        } catch (DatabaseException $e) {
            return ApiResponse::error('CONFLICT', 'Jabatan masih dipakai karyawan', null, 409);
        }

        return ApiResponse::success(null, 'Jabatan dihapus');
    }

    private function rules(?int $id): array
    {
        $unique = $id === null ? 'is_unique[jabatan.nama]' : 'is_unique[jabatan.nama,id,' . $id . ']';

        return [
            'nama'          => 'required|min_length[2]|max_length[100]|' . $unique,
            'departemen_id' => 'permit_empty|is_natural_no_zero|is_not_unique[departemen.id]',
        ];
    }

    private function messages(): array
    {
        return [
            'nama' => [
                'required'   => 'Nama jabatan wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
                'max_length' => 'Nama maksimal 100 karakter',
                'is_unique'  => 'Nama jabatan sudah dipakai',
            ],
            'departemen_id' => [
                'is_natural_no_zero' => 'Departemen tidak valid',
                'is_not_unique'      => 'Departemen tidak ditemukan',
            ],
        ];
    }
}
'@

# ================================================================
Tulis 'app\Controllers\Api\V1\Pengaturan.php' @'
<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\PengaturanModel;

class Pengaturan extends BaseController
{
    private PengaturanModel $model;

    public function __construct()
    {
        $this->model = new PengaturanModel();
    }

    /** Semua pengaturan, ditambah lokasi_absensi dari tabelnya (kontrak bagian 11) */
    private function gabungan(): object
    {
        $data                   = $this->model->semua();
        $data['lokasi_absensi'] = $this->lokasi();
        return (object) $data;
    }

    private function lokasi(): array
    {
        $rows = db_connect()->table('lokasi_absensi')->where('aktif', 1)->orderBy('id', 'ASC')->get()->getResultArray();

        return array_map(static fn ($r) => [
            'id'           => (int) $r['id'],
            'nama'         => $r['nama'],
            'alamat'       => $r['alamat'],
            'latitude'     => (float) $r['latitude'],
            'longitude'    => (float) $r['longitude'],
            'radius_meter' => (int) $r['radius_meter'],
            'wajib_lokasi' => (bool) $r['wajib_lokasi'],
        ], $rows);
    }

    // GET /api/v1/pengaturan
    public function index()
    {
        return ApiResponse::success($this->gabungan());
    }

    // GET /api/v1/pengaturan/(:segment)
    public function show($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Key tidak valid', ['key' => $this->pesanKey()], 422);
        }

        $row = $this->model->ambil($key);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Pengaturan tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    // PUT /api/v1/pengaturan/(:segment)   body: {"value": ...}
    public function simpan($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Key tidak valid', ['key' => $this->pesanKey()], 422);
        }

        $in = $this->request->getJSON(true) ?? [];
        if (! array_key_exists('value', $in) || $in['value'] === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['value' => 'Value wajib diisi'], 422);
        }

        $this->model->simpan($key, $in['value']);

        return ApiResponse::success($this->model->ambil($key), 'Pengaturan disimpan');
    }

    // PUT /api/v1/pengaturan   body: {"perusahaan": {...}, "kebijakan_gaji": {...}}  (boleh sebagian)
    // Format lama {"pengaturan": {...}} tetap diterima. lokasi_absensi diabaikan (dikelola lewat /lokasi-absensi).
    public function simpanMassal()
    {
        $in   = $this->request->getJSON(true) ?? [];
        $data = (isset($in['pengaturan']) && is_array($in['pengaturan'])) ? $in['pengaturan'] : $in;
        unset($data['lokasi_absensi']);

        if (! is_array($data) || $data === []) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'pengaturan' => 'Kirim objek {"key": value, ...} yang tidak kosong',
            ], 422);
        }
        if (count($data) > 50) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['pengaturan' => 'Maksimal 50 key sekali simpan'], 422);
        }

        $errors = [];
        foreach ($data as $k => $v) {
            if (! $this->keyValid((string) $k)) {
                $errors[(string) $k] = $this->pesanKey();
            } elseif ($v === null) {
                $errors[(string) $k] = 'Value wajib diisi';
            }
        }
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $db = db_connect();
        $db->transBegin();
        try {
            foreach ($data as $k => $v) {
                $this->model->simpan((string) $k, $v);
            }
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal simpan pengaturan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan pengaturan', null, 500);
        }

        return ApiResponse::success($this->gabungan(), 'Pengaturan disimpan');
    }

    // DELETE /api/v1/pengaturan/(:segment)
    public function delete($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key) || ! $this->model->ambil($key)) {
            return ApiResponse::error('NOT_FOUND', 'Pengaturan tidak ditemukan', null, 404);
        }

        $this->model->hapus($key);
        return ApiResponse::success(null, 'Pengaturan dihapus');
    }

    private function keyValid(string $key): bool
    {
        return (bool) preg_match('/^[a-zA-Z0-9_.\-]{1,80}$/', $key);
    }

    private function pesanKey(): string
    {
        return 'Key hanya boleh huruf, angka, titik, strip, dan underscore (maksimal 80 karakter)';
    }
}
'@

# ================================================================
# Patch: KomponenGaji.php (PATCH status dan parameter search)
$kgPath = Join-Path (Get-Location).Path 'app\Controllers\Api\V1\KomponenGaji.php'
if (Test-Path $kgPath) {
    $k = [System.IO.File]::ReadAllText($kgPath)
    if ($k.Contains('function status(')) {
        Write-Host "KomponenGaji sudah dipatch, dilewati." -ForegroundColor Yellow
    } else {
        $penanda = '    // ---------- helper ----------'
        if (-not $k.Contains($penanda)) {
            Write-Host "Peringatan: penanda helper di KomponenGaji.php tidak ditemukan, patch dilewati." -ForegroundColor Yellow
        } else {
            Copy-Item $kgPath "$kgPath.bak7" -Force
            $metode = @'
    // PATCH /api/v1/komponen-gaji/(:num)/status   body: {"aktif": true|false}
    public function status($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Komponen gaji tidak ditemukan', null, 404);
        }

        $in = $this->request->getJSON(true) ?? [];
        if (! array_key_exists('aktif', $in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Aktif wajib diisi (true atau false)'], 422);
        }
        $v = filter_var($in['aktif'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($v === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['aktif' => 'Nilai aktif harus true atau false'], 422);
        }

        $this->model->update($id, ['aktif' => (int) $v]);

        return ApiResponse::success(KomponenGajiModel::format($this->model->find($id)), 'Status komponen diperbarui');
    }
'@
            $k = $k.Replace('$this->request->getGet(''q'')', '($this->request->getGet(''search'') ?? $this->request->getGet(''q''))')
            $k = $k.Replace($penanda, $metode + "`r`n`r`n" + $penanda)
            [System.IO.File]::WriteAllText($kgPath, $k, $utf8)
            [void]$ditulis.Add('app\Controllers\Api\V1\KomponenGaji.php')
            Write-Host "dipatch: KomponenGaji.php (PATCH status, search)" -ForegroundColor Green
        }
    }
}

# ================================================================
Write-Host ""
Write-Host "== Cek sintaks PHP ==" -ForegroundColor Cyan
$adaError = $false
foreach ($f in $ditulis) {
    if ($f -like '*.php') {
        $o = & php -l $f 2>&1
        if ($LASTEXITCODE -ne 0) {
            $adaError = $true
            Write-Host "ERROR sintaks: $f" -ForegroundColor Red
            Write-Host ($o | Out-String)
        }
    }
}
if (-not $adaError) { Write-Host "Semua file PHP lolos cek sintaks." -ForegroundColor Green }

Write-Host ""
Write-Host "Selesai. Langkah berikutnya:"
Write-Host "  1. Restart server: Ctrl+C di terminal php spark serve, lalu jalankan lagi"
Write-Host "  2. Tes tahap 2:  powershell -ExecutionPolicy Bypass -File .\tes_kontrak_2.ps1"
Write-Host "  3. Tes tahap 1 dan tes lama tetap harus lulus"