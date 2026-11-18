<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\JadwalKerjaModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

class JadwalKerja extends BaseController
{
    private const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

    private JadwalKerjaModel $model;

    public function __construct()
    {
        $this->model = new JadwalKerjaModel();
    }

    // GET /api/v1/jadwal-kerja?page=1&per_page=10&q=reguler
    public function index()
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) $this->request->getGet('q'));

        if ($q !== '') {
            $this->model->like('nama', $q);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('is_default', 'DESC')->orderBy('nama', 'ASC')
            ->findAll($perPage, ($page - 1) * $perPage);

        return ApiResponse::success($rows, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    public function show($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Jadwal kerja tidak ditemukan', null, 404);
        }
        return ApiResponse::success($row);
    }

    public function create()
    {
        $input = $this->normalisasi($this->request->getJSON(true) ?? []);

        if ($errors = $this->validasi($input, null)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $data = $this->payload($input, null);

        $db = db_connect();
        $db->transBegin();
        try {
            if ($data['is_default'] === 1) {
                $db->table('jadwal_kerja')->update(['is_default' => 0]);
            }
            $id = $this->model->insert($data, true);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan jadwal kerja', null, 500);
        }

        return ApiResponse::success($this->model->find($id), 'Jadwal kerja dibuat', null, 201);
    }

    public function update($id = null)
    {
        $lama = $this->model->find($id);
        if (! $lama) {
            return ApiResponse::error('NOT_FOUND', 'Jadwal kerja tidak ditemukan', null, 404);
        }

        $input = $this->normalisasi($this->request->getJSON(true) ?? []);

        if ($errors = $this->validasi($input, (int) $id)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $data = $this->payload($input, $lama);

        if ((int) $lama['is_default'] === 1 && $data['is_default'] === 0) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'is_default' => 'Harus ada satu jadwal default. Jadikan jadwal lain sebagai default.',
            ], 422);
        }

        $db = db_connect();
        $db->transBegin();
        try {
            if ($data['is_default'] === 1) {
                $db->table('jadwal_kerja')->where('id !=', (int) $id)->update(['is_default' => 0]);
            }
            $this->model->update($id, $data);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            return ApiResponse::error('SERVER_ERROR', 'Gagal memperbarui jadwal kerja', null, 500);
        }

        return ApiResponse::success($this->model->find($id), 'Jadwal kerja diperbarui');
    }

    public function delete($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Jadwal kerja tidak ditemukan', null, 404);
        }

        if ((int) $row['is_default'] === 1) {
            return ApiResponse::error('IS_DEFAULT', 'Jadwal default tidak bisa dihapus. Jadikan jadwal lain default dulu.', null, 409);
        }

        try {
            $this->model->delete($id);
        } catch (DatabaseException $e) {
            return ApiResponse::error('IN_USE', 'Jadwal kerja masih dipakai data lain', null, 409);
        }

        return ApiResponse::success(null, 'Jadwal kerja dihapus');
    }

    // Rapikan input: jam "08:00:00" jadi "08:00"
    private function normalisasi(array $in): array
    {
        foreach (['jam_masuk', 'jam_pulang'] as $k) {
            if (isset($in[$k]) && is_string($in[$k]) && strlen($in[$k]) === 8) {
                $in[$k] = substr($in[$k], 0, 5);
            }
        }
        return $in;
    }

    // Array/teks nama hari atau angka 1-7 -> "senin,selasa,..." (unik, urut). Salah format -> null
    private function normalisasiHari($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $list = is_array($value) ? $value : explode(',', (string) $value);
        $ada  = [];
        foreach ($list as $h) {
            $h = strtolower(trim((string) $h));
            if (ctype_digit($h) && (int) $h >= 1 && (int) $h <= 7) {
                $h = self::HARI[(int) $h - 1];
            }
            if (! in_array($h, self::HARI, true)) {
                return null;
            }
            $ada[$h] = true;
        }
        if (! $ada) {
            return null;
        }
        $hasil = [];
        foreach (self::HARI as $h) {
            if (isset($ada[$h])) {
                $hasil[] = $h;
            }
        }
        return implode(',', $hasil);
    }

    private function validasi(array $input, ?int $id): array
    {
        $validation = service('validation');
        $validation->setRules($this->rules($id), $this->messages());
        $validation->run($input);
        $errors = $validation->getErrors();

        if ($this->normalisasiHari($input['hari_kerja'] ?? null) === null) {
            $errors['hari_kerja'] = 'Hari kerja wajib diisi, contoh ["senin","selasa","rabu","kamis","jumat"]';
        }

        return $errors;
    }

    private function payload(array $in, ?array $lama): array
    {
        $default = array_key_exists('is_default', $in)
            ? (filter_var($in['is_default'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0)
            : (int) ($lama['is_default'] ?? 0);

        return [
            'nama'            => trim($in['nama']),
            'jam_masuk'       => $in['jam_masuk'] . ':00',
            'jam_pulang'      => $in['jam_pulang'] . ':00',
            'toleransi_menit' => isset($in['toleransi_menit']) ? (int) $in['toleransi_menit'] : (int) ($lama['toleransi_menit'] ?? 0),
            'hari_kerja'      => $this->normalisasiHari($in['hari_kerja']),
            'is_default'      => $default,
        ];
    }

    private function rules(?int $id): array
    {
        $ex = $id === null ? '' : ',id,' . $id;

        return [
            'nama'            => 'required|min_length[2]|max_length[100]|is_unique[jadwal_kerja.nama' . $ex . ']',
            'jam_masuk'       => 'required|valid_date[H:i]',
            'jam_pulang'      => 'required|valid_date[H:i]',
            'toleransi_menit' => 'permit_empty|is_natural|less_than_equal_to[240]',
        ];
    }

    private function messages(): array
    {
        return [
            'nama' => [
                'required'   => 'Nama jadwal wajib diisi',
                'min_length' => 'Nama minimal 2 karakter',
                'is_unique'  => 'Nama jadwal sudah dipakai',
            ],
            'jam_masuk' => [
                'required'   => 'Jam masuk wajib diisi',
                'valid_date' => 'Format jam masuk harus HH:MM, contoh 08:00',
            ],
            'jam_pulang' => [
                'required'   => 'Jam pulang wajib diisi',
                'valid_date' => 'Format jam pulang harus HH:MM, contoh 17:00',
            ],
            'toleransi_menit' => [
                'is_natural'         => 'Toleransi harus bilangan bulat 0 atau lebih',
                'less_than_equal_to' => 'Toleransi maksimal 240 menit',
            ],
        ];
    }
}