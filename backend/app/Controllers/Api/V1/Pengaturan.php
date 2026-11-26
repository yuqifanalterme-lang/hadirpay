<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Models\PengaturanModel;
use App\Services\AttendanceService;

class Pengaturan extends BaseController
{
    private const KHUSUS = ['jadwal_kerja', 'lokasi_absensi'];

    private PengaturanModel $model;

    public function __construct()
    {
        $this->model = new PengaturanModel();
    }

    /** Nilai bawaan bila belum pernah disimpan (kontrak bagian 11) */
    private function bawaan(): array
    {
        return [
            'perusahaan'         => ['nama' => 'PT Contoh Sejahtera', 'alamat' => 'Jl. Sudirman No. 21, Jakarta', 'npwp' => null, 'logo_url' => null],
            'kebijakan_gaji'     => [
                'metode_potongan_alpha'     => 'tarif_harian',
                'pembagi_hari_kerja'        => 'hari_kerja_periode',
                'tanggal_tutup_periode'     => 25,
                'potongan_izin_tanpa_surat' => false,
            ],
            'kuota_cuti_tahunan' => 12,
        ];
    }

    /** jadwal_kerja selalu dibaca dari tabelnya lewat AttendanceService (sumber yang dipakai absensi) */
    private function jadwal(): array
    {
        try {
            $j = (new AttendanceService())->jadwal();
        } catch (\Throwable $e) {
            $j = [];
        }

        $hari = $j['hari_kerja'] ?? null;
        if (is_string($hari)) {
            $d    = json_decode($hari, true);
            $hari = is_array($d) ? $d : array_values(array_filter(array_map('trim', explode(',', $hari))));
        }
        if (! is_array($hari) || ! $hari) {
            $hari = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
        }

        return [
            'jam_masuk'       => substr((string) ($j['jam_masuk'] ?? '08:00'), 0, 5),
            'jam_pulang'      => substr((string) ($j['jam_pulang'] ?? '17:00'), 0, 5),
            'toleransi_menit' => (int) ($j['toleransi_menit'] ?? 0),
            'hari_kerja'      => array_values($hari),
        ];
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

    private function gabungan(): array
    {
        $data                   = array_merge($this->bawaan(), $this->model->semua());
        if (isset($data['kebijakan_gaji']) && is_array($data['kebijakan_gaji'])) {
            unset($data['kebijakan_gaji']['tarif_lembur_per_jam']);
        }
        $data['jadwal_kerja']   = $this->jadwal();
        $data['lokasi_absensi'] = $this->lokasi();
        return $data;
    }

    // GET /api/v1/pengaturan
    public function index()
    {
        return ApiResponse::success((object) $this->gabungan());
    }

    // GET /api/v1/pengaturan/(:segment)
    public function show($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Key tidak valid', ['key' => $this->pesanKey()], 422);
        }

        $semua = $this->gabungan();
        if (! array_key_exists($key, $semua)) {
            return ApiResponse::error('NOT_FOUND', 'Pengaturan tidak ditemukan', null, 404);
        }

        $row = $this->model->ambil($key);
        return ApiResponse::success(['key' => $key, 'value' => $semua[$key], 'updated_at' => $row['updated_at'] ?? null]);
    }

    // PUT /api/v1/pengaturan/(:segment)   body: {"value": ...}
    public function simpan($key = null)
    {
        $key = (string) $key;
        if (! $this->keyValid($key)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Key tidak valid', ['key' => $this->pesanKey()], 422);
        }
        if (in_array($key, self::KHUSUS, true)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['key' => 'Key ini dikelola lewat PUT /pengaturan (jadwal_kerja) atau /lokasi-absensi'], 422);
        }

        $in = $this->request->getJSON(true) ?? [];
        if (! array_key_exists('value', $in) || $in['value'] === null) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['value' => 'Value wajib diisi'], 422);
        }

        $this->model->simpan($key, $in['value']);

        return ApiResponse::success($this->model->ambil($key), 'Pengaturan disimpan');
    }

    // PUT /api/v1/pengaturan   body: {"perusahaan": {...}, "jadwal_kerja": {...}}  (boleh sebagian)
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

        $jadwal = null;
        if (array_key_exists('jadwal_kerja', $data)) {
            $jadwal = $data['jadwal_kerja'];
            unset($data['jadwal_kerja']);
        }

        $errors = [];
        foreach ($data as $k => $v) {
            if (! $this->keyValid((string) $k)) {
                $errors[(string) $k] = $this->pesanKey();
            } elseif ($v === null) {
                $errors[(string) $k] = 'Value wajib diisi';
            }
        }
        if ($jadwal !== null) {
            $errors += $this->cekJadwal($jadwal);
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
            if ($jadwal !== null) {
                $this->simpanJadwal($jadwal);
            }
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal simpan pengaturan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan pengaturan', null, 500);
        }

        return ApiResponse::success((object) $this->gabungan(), 'Pengaturan disimpan');
    }

    // POST /api/v1/pengaturan/logo   multipart/form-data field: logo
    public function logo()
    {
        $file = $this->request->getFile('logo');
        if (! $file || ! $file->isValid()) {
            return ApiResponse::error('VALIDATION_ERROR', 'File logo wajib diisi', ['logo' => 'Logo tidak valid'], 422);
        }
        if (! in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Format logo tidak didukung', ['logo' => 'Gunakan JPG, PNG, atau WEBP'], 422);
        }
        if ($file->getSize() > 2 * 1024 * 1024) {
            return ApiResponse::error('VALIDATION_ERROR', 'Ukuran logo terlalu besar', ['logo' => 'Maksimal 2 MB'], 422);
        }

        $dir = FCPATH . 'uploads' . DIRECTORY_SEPARATOR . 'pengaturan';
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $name = $file->getRandomName();
        if (! $file->move($dir, $name)) {
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan logo', null, 500);
        }

        $url = base_url('uploads/pengaturan/' . $name);
        $perusahaan = $this->model->ambil('perusahaan');
        $value = is_array($perusahaan['value'] ?? null) ? $perusahaan['value'] : $this->bawaan()['perusahaan'];
        $value['logo_url'] = $url;
        $this->model->simpan('perusahaan', $value);

        return ApiResponse::success(['logo_url' => $url], 'Logo perusahaan diperbarui');
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

    // ---------- jadwal kerja ----------

    private function cekJadwal($j): array
    {
        if (! is_array($j)) {
            return ['jadwal_kerja' => 'jadwal_kerja harus berupa objek'];
        }

        $e   = [];
        $jam = '/^([01]\d|2[0-3]):[0-5]\d$/';
        foreach (['jam_masuk', 'jam_pulang'] as $f) {
            if (isset($j[$f]) && ! preg_match($jam, (string) $j[$f])) {
                $e['jadwal_kerja.' . $f] = 'Format jam harus HH:mm';
            }
        }
        if (isset($j['toleransi_menit']) && (! is_numeric($j['toleransi_menit']) || (int) $j['toleransi_menit'] < 0 || (int) $j['toleransi_menit'] > 240)) {
            $e['jadwal_kerja.toleransi_menit'] = 'Toleransi 0 sampai 240 menit';
        }
        if (isset($j['hari_kerja'])) {
            $validHari = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            if (! is_array($j['hari_kerja']) || array_diff(array_map('strtolower', $j['hari_kerja']), $validHari)) {
                $e['jadwal_kerja.hari_kerja'] = 'Hari kerja harus berisi nama hari yang valid';
            }
        }
        if (! $e) {
            $skrg = $this->jadwal();
            $m    = (string) ($j['jam_masuk'] ?? $skrg['jam_masuk']);
            $p    = (string) ($j['jam_pulang'] ?? $skrg['jam_pulang']);
            if ($p <= $m) {
                $e['jadwal_kerja.jam_pulang'] = 'Jam pulang harus setelah jam masuk';
            }
        }
        return $e;
    }

    /** Sinkronkan semua properti jadwal kerja yang didukung kontrak. */
    private function simpanJadwal(array $j): void
    {
        $upd = [];
        if (isset($j['jam_masuk'])) {
            $upd['jam_masuk'] = $j['jam_masuk'] . ':00';
        }
        if (isset($j['jam_pulang'])) {
            $upd['jam_pulang'] = $j['jam_pulang'] . ':00';
        }
        if (isset($j['toleransi_menit'])) {
            $upd['toleransi_menit'] = (int) $j['toleransi_menit'];
        }
        if (isset($j['hari_kerja']) && is_array($j['hari_kerja'])) {
            $upd['hari_kerja'] = implode(',', array_map('strtolower', $j['hari_kerja']));
        }
        if (! $upd) {
            return;
        }

        $db  = db_connect();
        $row = null;
        try {
            $row = $db->table('jadwal_kerja')->select('id')->orderBy('is_default', 'DESC')->orderBy('id', 'ASC')->limit(1)->get()->getRowArray();
        } catch (\Throwable $e) {
            $row = null;
        }
        if (! $row) {
            $row = $db->table('jadwal_kerja')->select('id')->orderBy('id', 'ASC')->limit(1)->get()->getRowArray();
        }
        if ($row) {
            $upd['updated_at'] = date('Y-m-d H:i:s');
            $db->table('jadwal_kerja')->where('id', (int) $row['id'])->update($upd);
        }
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