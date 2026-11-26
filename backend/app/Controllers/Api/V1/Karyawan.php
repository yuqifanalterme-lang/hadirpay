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
            ->select('kk.komponen_id, kg.kode, kg.nama, kg.tipe, kg.metode, kk.metode_override, kk.nilai')
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
            'tunjangan_tetap'  => (float) ($this->nilaiKomponen($komp, 'TUN-TRANSPORT') ?? 0),
            'bpjs_persen'      => (float) ($this->nilaiKomponen($komp, 'BPJS') ?? 3),
            'pph21_metode'     => $this->metodeKomponen($komp, 'PPH21') ?? 'nominal_tetap',
            'potongan_lembur'  => (float) ($this->nilaiKomponen($komp, 'POT-LEMBUR') ?? 0),
            'npwp'             => $r['npwp'],
            'no_bpjs'          => $r['no_bpjs'],
            'status'           => $r['status'],
            'role'             => $r['akun_role'],
            'komponen_gaji'    => array_map(static fn ($k) => [
                'komponen_id' => (int) $k['komponen_id'],
                'kode'        => $k['kode'],
                'nama'        => $k['nama'],
                'tipe'        => $k['tipe'],
                'metode'      => $k['metode_override'] ?: $k['metode'],
                'metode_override' => $k['metode_override'],
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
        $sort    = self::SORT[(string) $this->request->getGet('sort')] ?? 'karyawan.kode';
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
        if (($input['pph21_metode'] ?? 'nominal_tetap') === 'persen' && (float) ($input['pph21'] ?? 0) > 100) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'pph21' => 'Persentase PPh 21 tidak boleh lebih dari 100',
            ], 422);
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
            $this->syncPph21(
                $db,
                (int) $id,
                (float) ($input['pph21'] ?? 0),
                (string) ($input['pph21_metode'] ?? 'nominal_tetap'),
                $now
            );
            $this->syncBpjs($db, (int) $id, (float) ($input['bpjs_persen'] ?? 3), $now);
            $this->syncKomponenManual(
                $db,
                (int) $id,
                'TUN-TRANSPORT',
                (float) ($input['tunjangan'] ?? $input['tunjangan_tetap'] ?? 0),
                $now
            );
            $this->syncKomponenManual(
                $db,
                (int) $id,
                'POT-LEMBUR',
                (float) ($input['potongan_lembur'] ?? 0),
                $now
            );
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
            'tunjangan'        => 0,
            'pph21_metode'     => 'nominal_tetap',
            'npwp'             => $lama['npwp'],
            'no_bpjs'          => $lama['no_bpjs'],
            'status'           => $lama['status'],
        ], $input);

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());
        if (! $validation->run($gabung)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }
        if (($input['pph21_metode'] ?? 'nominal_tetap') === 'persen' && (float) ($input['pph21'] ?? 0) > 100) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'pph21' => 'Persentase PPh 21 tidak boleh lebih dari 100',
            ], 422);
        }
        if ($err = $this->cekJabatan($gabung)) {
            return $err;
        }

        $data = $this->payload($gabung);
        if (empty($data['kode'])) {
            $data['kode'] = $lama['kode'];
        }

        $db = db_connect();
        $komponenUpdates = [];
        if (array_key_exists('komponen_gaji', $input)) {
            if (! is_array($input['komponen_gaji'])) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data komponen tidak valid', [
                    'komponen_gaji' => 'Daftar komponen harus berupa array',
                ], 422);
            }
            $seen = [];
            foreach ($input['komponen_gaji'] as $item) {
                if (! is_array($item)
                    || ! isset($item['komponen_id'])
                    || ! is_numeric($item['komponen_id'])
                    || (int) $item['komponen_id'] < 1
                    || ! array_key_exists('nilai', $item)
                    || ! is_numeric($item['nilai'])
                    || (float) $item['nilai'] < 0
                ) {
                    return ApiResponse::error('VALIDATION_ERROR', 'Data komponen tidak valid', [
                        'komponen_gaji' => 'Setiap komponen harus memiliki ID dan nilai nol atau lebih',
                    ], 422);
                }

                $komponenId = (int) $item['komponen_id'];
                if (isset($seen[$komponenId])) {
                    return ApiResponse::error('VALIDATION_ERROR', 'Data komponen tidak valid', [
                        'komponen_gaji' => 'Komponen yang sama tidak boleh dikirim lebih dari sekali',
                    ], 422);
                }
                $seen[$komponenId] = true;

                $masterComponent = $db->table('komponen_gaji')
                    ->select('kode, nilai, metode')
                    ->where('id', $komponenId)
                    ->get()->getRowArray();
                if ($masterComponent) {
                    $kode = $masterComponent['kode'];
                    if (in_array($kode, ['BPJS', 'PPH21', 'TUN-TRANSPORT', 'POT-LEMBUR', 'POT-ALPHA', 'POT-TELAT'], true)) {
                        continue;
                    }
                }

                $assignment = $db->table('karyawan_komponen kk')
                    ->select('kk.id, COALESCE(kk.metode_override, kg.metode) AS metode')
                    ->join('komponen_gaji kg', 'kg.id = kk.komponen_id')
                    ->where('kk.karyawan_id', (int) $id)
                    ->where('kk.komponen_id', $komponenId)
                    ->get()->getRowArray();
                if (! $assignment) {
                    return ApiResponse::error('VALIDATION_ERROR', 'Data komponen tidak valid', [
                        'komponen_gaji' => 'Komponen tidak terpasang pada karyawan ini',
                    ], 422);
                }
                if ($assignment['metode'] === 'persen' && (float) $item['nilai'] > 100) {
                    return ApiResponse::error('VALIDATION_ERROR', 'Data komponen tidak valid', [
                        'komponen_gaji' => 'Nilai persentase tidak boleh lebih dari 100',
                    ], 422);
                }
                $komponenUpdates[] = ['id' => (int) $assignment['id'], 'nilai' => $item['nilai']];
            }
        }

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
            if (array_key_exists('pph21', $input)) {
                $this->syncPph21(
                    $db,
                    (int) $id,
                    (float) $input['pph21'],
                    (string) ($input['pph21_metode'] ?? 'nominal_tetap'),
                    date('Y-m-d H:i:s')
                );
            } elseif (array_key_exists('pph21_metode', $input)) {
                $currentPph = $this->nilaiKomponen(
                    $db->table('karyawan_komponen kk')
                        ->select('kg.kode, kk.nilai')
                        ->join('komponen_gaji kg', 'kg.id = kk.komponen_id')
                        ->where('kk.karyawan_id', (int) $id)
                        ->get()->getResultArray(),
                    'PPH21'
                );
                $this->syncPph21(
                    $db,
                    (int) $id,
                    $currentPph ?? 0,
                    (string) $input['pph21_metode'],
                    date('Y-m-d H:i:s')
                );
            }
            if (array_key_exists('bpjs_persen', $input)) {
                $this->syncBpjs($db, (int) $id, (float) $input['bpjs_persen'], date('Y-m-d H:i:s'));
            }
            if (array_key_exists('potongan_lembur', $input)) {
                $this->syncKomponenManual(
                    $db,
                    (int) $id,
                    'POT-LEMBUR',
                    (float) $input['potongan_lembur'],
                    date('Y-m-d H:i:s')
                );
            }
            if (array_key_exists('tunjangan', $input) || array_key_exists('tunjangan_tetap', $input)) {
                $this->syncKomponenManual(
                    $db,
                    (int) $id,
                    'TUN-TRANSPORT',
                    (float) ($input['tunjangan'] ?? $input['tunjangan_tetap']),
                    date('Y-m-d H:i:s')
                );
            }
            foreach ($komponenUpdates as $komponenUpdate) {
                $db->table('karyawan_komponen')->where('id', $komponenUpdate['id'])->update([
                    'nilai' => $komponenUpdate['nilai'],
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            }

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

    // DELETE /api/v1/karyawan/(:num) - hapus data individual, pertahankan jurnal dan log periode bersama
    public function delete($id = null)
    {
        $id = (int) $id;
        $db = db_connect();
        $lampiran = [];
        $db->transBegin();
        try {
            $karyawan = $this->model->find($id);
            if (! $karyawan) {
                $db->transRollback();
                return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
            }

            $akun = $db->table('users')->where('karyawan_id', $id)->get()->getRowArray();
            $userSaatIni = JwtService::$user ?? [];
            if ($akun && (int) ($userSaatIni['id'] ?? 0) === (int) $akun['id']) {
                $db->transRollback();
                return ApiResponse::error('CONFLICT', 'Anda tidak bisa menghapus akun karyawan sendiri', null, 409);
            }

            $pengajuan = $db->table('pengajuan_izin')
                ->select('id, lampiran_path')
                ->where('karyawan_id', $id)
                ->get()->getResultArray();
            $lampiran = array_values(array_filter(array_column($pengajuan, 'lampiran_path')));
            $pengajuanIds = array_map(static fn ($row) => (int) $row['id'], $pengajuan);
            $penggajianIds = array_map(
                'intval',
                array_column(
                    $db->table('penggajian')->select('id')->where('karyawan_id', $id)->get()->getResultArray(),
                    'id'
                )
            );

            if ($pengajuanIds) {
                $db->table('absensi')->whereIn('pengajuan_id', $pengajuanIds)->delete();
            }
            $db->table('absensi')->where('karyawan_id', $id)->delete();
            $db->table('pengajuan_izin')->where('karyawan_id', $id)->delete();

            if ($penggajianIds) {
                $db->table('slip_gaji')->whereIn('penggajian_id', $penggajianIds)->delete();
                $db->table('penggajian')->whereIn('id', $penggajianIds)->delete();
            }
            $db->table('karyawan_komponen')->where('karyawan_id', $id)->delete();
            $db->table('kuota_cuti')->where('karyawan_id', $id)->delete();

            if ($akun) {
                $userId = (int) $akun['id'];
                $db->table('pengajuan_izin')->where('diproses_oleh', $userId)->update(['diproses_oleh' => null]);
                $db->table('periode_gaji')->where('dibuat_oleh', $userId)->update(['dibuat_oleh' => null]);
                $db->table('periode_status_log')->where('oleh', $userId)->update(['oleh' => null]);
                $db->table('jurnal')->where('dibuat_oleh', $userId)->update(['dibuat_oleh' => null]);
                $db->table('jurnal')->where('cancelled_by', $userId)->update(['cancelled_by' => null]);
                $db->table('jurnal')->where('dibatalkan_oleh', $userId)->update(['dibatalkan_oleh' => null]);
                $db->table('users')->where('id', $userId)->delete();
            }
            $this->model->delete($id);
            if ($db->transStatus() === false) {
                throw new \RuntimeException('Penghapusan karyawan tidak berhasil disimpan.');
            }
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal hapus karyawan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menghapus karyawan', null, 500);
        }

        foreach ($lampiran as $path) {
            $this->hapusLampiranKaryawan($path);
        }

        return ApiResponse::success(null, 'Karyawan dihapus');
    }

    private function hapusLampiranKaryawan(string $path): void
    {
        $relative = str_replace('\\', '/', ltrim($path, '/\\'));
        if (! str_starts_with($relative, 'uploads/lampiran/')) {
            log_message('error', 'Path lampiran pengajuan tidak berada di direktori yang diizinkan saat hapus karyawan.');
            return;
        }

        $directory = realpath(WRITEPATH . 'uploads/lampiran');
        $file = realpath(WRITEPATH . str_replace('/', DIRECTORY_SEPARATOR, $relative));
        if ($directory === false || $file === false || dirname($file) !== $directory || ! is_file($file)) {
            return;
        }
        if (! unlink($file)) {
            log_message('error', 'Gagal menghapus lampiran pengajuan saat hapus karyawan: ' . basename($file));
        }
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

        $c['hadir'] += $c['terlambat'];
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
            'tunjangan_tetap'  => 0,
            'npwp'             => $in['npwp'] ?? null,
            'no_bpjs'          => $in['no_bpjs'] ?? null,
            'status'           => $in['status'] ?? 'aktif',
        ];
    }

    private function syncPph21($db, int $karyawanId, float $nilai, string $metode, string $now): void
    {
        if (! in_array($metode, ['nominal_tetap', 'persen'], true)) {
            throw new \InvalidArgumentException('Metode PPh 21 tidak valid');
        }
        $komponen = $db->table('komponen_gaji')->where('kode', 'PPH21')->get()->getRowArray();
        if (! $komponen) {
            $db->table('komponen_gaji')->insert([
                'kode' => 'PPH21',
                'nama' => 'PPh 21',
                'tipe' => 'potongan',
                'metode' => 'nominal_tetap',
                'nilai' => null,
                'keterangan' => null,
                'sistem' => 1,
                'aktif' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $komponen = $db->table('komponen_gaji')->where('kode', 'PPH21')->get()->getRowArray();
        } elseif ((int) $komponen['aktif'] !== 1 || $komponen['metode'] !== 'nominal_tetap') {
            $db->table('komponen_gaji')->where('id', (int) $komponen['id'])->update([
                'tipe' => 'potongan',
                'metode' => 'nominal_tetap',
                'nilai' => null,
                'aktif' => 1,
                'updated_at' => $now,
            ]);
        }

        $assigned = $db->table('karyawan_komponen')
            ->where('karyawan_id', $karyawanId)
            ->where('komponen_id', (int) $komponen['id'])
            ->get()->getRowArray();
        if ($assigned) {
            $db->table('karyawan_komponen')->where('id', $assigned['id'])->update([
                'nilai' => $nilai,
                'metode_override' => $metode === $komponen['metode'] ? null : $metode,
                'updated_at' => $now,
            ]);
            return;
        }

        $db->table('karyawan_komponen')->insert([
            'karyawan_id' => $karyawanId,
            'komponen_id' => (int) $komponen['id'],
            'nilai' => $nilai,
            'metode_override' => $metode === $komponen['metode'] ? null : $metode,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function syncBpjs($db, int $karyawanId, float $nilai, string $now): void
    {
        $komponen = $db->table('komponen_gaji')->where('kode', 'BPJS')->get()->getRowArray();
        if (! $komponen) {
            $db->table('komponen_gaji')->insert([
                'kode' => 'BPJS',
                'nama' => 'Iuran BPJS',
                'tipe' => 'potongan',
                'metode' => 'persen',
                'nilai' => 3,
                'keterangan' => null,
                'sistem' => 1,
                'aktif' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $komponen = $db->table('komponen_gaji')->where('kode', 'BPJS')->get()->getRowArray();
        } elseif ((int) $komponen['aktif'] !== 1 || $komponen['tipe'] !== 'potongan' || $komponen['metode'] !== 'persen') {
            $db->table('komponen_gaji')->where('id', (int) $komponen['id'])->update([
                'tipe' => 'potongan',
                'metode' => 'persen',
                'nilai' => $komponen['nilai'] ?? 3,
                'aktif' => 1,
                'updated_at' => $now,
            ]);
        }

        $assigned = $db->table('karyawan_komponen')
            ->where('karyawan_id', $karyawanId)
            ->where('komponen_id', (int) $komponen['id'])
            ->get()->getRowArray();
        if ($assigned) {
            $db->table('karyawan_komponen')->where('id', $assigned['id'])->update([
                'nilai' => $nilai,
                'updated_at' => $now,
            ]);
            return;
        }

        $db->table('karyawan_komponen')->insert([
            'karyawan_id' => $karyawanId,
            'komponen_id' => (int) $komponen['id'],
            'nilai' => $nilai,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function nilaiKomponen(array $komponen, string $kode): ?float
    {
        foreach ($komponen as $row) {
            if ($row['kode'] === $kode) {
                return (float) $row['nilai'];
            }
        }
        return null;
    }

    private function metodeKomponen(array $komponen, string $kode): ?string
    {
        foreach ($komponen as $row) {
            if ($row['kode'] === $kode) {
                return $row['metode_override'] ?: $row['metode'];
            }
        }
        return null;
    }

    private function syncKomponenManual($db, int $karyawanId, string $kode, float $nilai, string $now): void
    {
        $komponen = $db->table('komponen_gaji')->where('kode', $kode)->get()->getRowArray();
        if (! $komponen) {
            $pendingName = $kode === 'TUN-TRANSPORT'
                ? 'Tunjangan transport'
                : ($kode === 'POT-LEMBUR' ? 'Potongan lembur per periode' : $kode);
            $pendingType = $kode === 'TUN-TRANSPORT' ? 'pendapatan' : 'potongan';
            $db->table('komponen_gaji')->insert([
                'kode' => $kode,
                'nama' => $pendingName,
                'tipe' => $pendingType,
                'metode' => 'nominal_tetap',
                'nilai' => null,
                'keterangan' => null,
                'sistem' => 1,
                'aktif' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $komponen = $db->table('komponen_gaji')->where('kode', $kode)->get()->getRowArray();
        } elseif ((int) $komponen['aktif'] !== 1 || $komponen['metode'] !== 'nominal_tetap') {
            $db->table('komponen_gaji')->where('id', (int) $komponen['id'])->update([
                'tipe' => $kode === 'TUN-TRANSPORT' ? 'pendapatan' : $komponen['tipe'],
                'metode' => 'nominal_tetap',
                'nilai' => null,
                'aktif' => 1,
                'updated_at' => $now,
            ]);
        }

        $assigned = $db->table('karyawan_komponen')
            ->where('karyawan_id', $karyawanId)
            ->where('komponen_id', (int) $komponen['id'])
            ->get()->getRowArray();
        if ($assigned) {
            $db->table('karyawan_komponen')->where('id', $assigned['id'])->update([
                'nilai' => $nilai,
                'updated_at' => $now,
            ]);
            return;
        }

        $db->table('karyawan_komponen')->insert([
            'karyawan_id' => $karyawanId,
            'komponen_id' => (int) $komponen['id'],
            'nilai' => $nilai,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
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
            'tunjangan'        => 'permit_empty|numeric|greater_than_equal_to[0]',
            'pph21'            => 'permit_empty|numeric|greater_than_equal_to[0]',
            'pph21_metode'     => 'permit_empty|in_list[nominal_tetap,persen]',
            'bpjs_persen'      => 'permit_empty|numeric|greater_than_equal_to[0]|less_than_equal_to[100]',
            'potongan_lembur'  => 'permit_empty|numeric|greater_than_equal_to[0]',
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
            'pph21'             => ['numeric' => 'Nilai PPh 21 harus berupa angka', 'greater_than_equal_to' => 'Nilai PPh 21 tidak boleh negatif'],
            'bpjs_persen'       => [
                'numeric' => 'Persentase BPJS harus berupa angka',
                'greater_than_equal_to' => 'Persentase BPJS tidak boleh negatif',
                'less_than_equal_to' => 'Persentase BPJS tidak boleh lebih dari 100',
            ],
            'potongan_lembur' => [
                'numeric' => 'Potongan lembur harus berupa angka',
                'greater_than_equal_to' => 'Potongan lembur tidak boleh negatif',
            ],
            'status'           => ['in_list' => 'Pilih aktif atau nonaktif'],
            'role'             => ['in_list' => 'Role harus admin_hrd, karyawan, keuangan, atau pemilik'],
            'password'         => [
                'required'   => 'Password wajib diisi',
                'min_length' => 'Password minimal 8 karakter',
            ],
        ];
    }
}