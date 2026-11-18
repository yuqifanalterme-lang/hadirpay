<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\KaryawanModel;

class Karyawan extends BaseController
{
    private KaryawanModel $model;

    public function __construct()
    {
        $this->model = new KaryawanModel();
    }

    private function withRelasi(): KaryawanModel
    {
        return $this->model
            ->select('karyawan.*, departemen.nama AS departemen_nama, jabatan.nama AS jabatan_nama, users.role AS akun_role, users.aktif AS akun_aktif')
            ->join('departemen', 'departemen.id = karyawan.departemen_id', 'left')
            ->join('jabatan', 'jabatan.id = karyawan.jabatan_id', 'left')
            ->join('users', 'users.karyawan_id = karyawan.id', 'left');
    }

    private function detail($id): ?array
    {
        return $this->withRelasi()->where('karyawan.id', $id)->first();
    }

    // GET /api/v1/karyawan?page=1&per_page=10&q=rina&status=aktif&departemen_id=1&jabatan_id=3
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) $this->request->getGet('q'));
        $status  = (string) $this->request->getGet('status');
        $deptId  = (int) ($this->request->getGet('departemen_id') ?? 0);
        $jabId   = (int) ($this->request->getGet('jabatan_id') ?? 0);

        $this->withRelasi();

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
        if ($deptId > 0) {
            $this->model->where('karyawan.departemen_id', $deptId);
        }
        if ($jabId > 0) {
            $this->model->where('karyawan.jabatan_id', $jabId);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('karyawan.nama', 'ASC')->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success($rows, 'OK', [
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

        $db = db_connect();

        if (empty($data['kode'])) {
            $max          = (int) $db->table('karyawan')->selectMax('id')->get()->getRow()->id;
            $data['kode'] = sprintf('KRY-%04d', $max + 1);
        }

        $role     = $input['role'] ?? 'karyawan';
        $password = $input['password'];

        $db->transBegin();
        try {
            $id = $this->model->insert($data, true);

            $now = date('Y-m-d H:i:s');
            $db->table('users')->insert([
                'karyawan_id'   => $id,
                'nama'          => $data['nama'],
                'email'         => $data['email'],
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'role'          => $role,
                'aktif'         => $data['status'] === 'aktif' ? 1 : 0,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan karyawan dan akun', null, 500);
        }

        $row         = $this->detail($id);
        $row['akun'] = [
            'email' => $data['email'],
            'role'  => $role,
        ];

        return ApiResponse::success($row, 'Karyawan dan akun dibuat', null, 201);
    }

    public function update($id = null)
    {
        $lama = $this->model->find($id);
        if (! $lama) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $input = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules($this->rules((int) $id), $this->messages());

        if (! $validation->run($input)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        if ($err = $this->cekJabatan($input)) {
            return $err;
        }

        $data = $this->payload($input);
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
            $db->table('users')->where('karyawan_id', (int) $id)->update($akun);

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            return ApiResponse::error('SERVER_ERROR', 'Gagal memperbarui karyawan', null, 500);
        }

        return ApiResponse::success($this->detail($id), 'Karyawan diperbarui');
    }

    // Tidak dihapus permanen: karyawan dan akunnya dinonaktifkan
    public function delete($id = null)
    {
        if (! $this->model->find($id)) {
            return ApiResponse::error('NOT_FOUND', 'Karyawan tidak ditemukan', null, 404);
        }

        $db = db_connect();
        $db->transBegin();
        try {
            $this->model->update($id, ['status' => 'nonaktif']);
            $db->table('users')->where('karyawan_id', (int) $id)->update([
                'aktif'      => 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            return ApiResponse::error('SERVER_ERROR', 'Gagal menonaktifkan karyawan', null, 500);
        }

        return ApiResponse::success($this->detail($id), 'Karyawan dinonaktifkan');
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