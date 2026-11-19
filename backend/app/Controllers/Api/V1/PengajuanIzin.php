<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Models\KuotaCutiModel;
use App\Models\PengajuanIzinModel;

class PengajuanIzin extends BaseController
{
    private PengajuanIzinModel $model;

    public function __construct()
    {
        $this->model = new PengajuanIzinModel();
    }

    /** Admin: semua pengajuan */
    public function index()
    {
        return $this->daftar(null);
    }

    /** Karyawan: pengajuan sendiri */
    public function saya()
    {
        $karyawanId = $this->karyawanIdSaatIni();
        if (! $karyawanId) {
            return ApiResponse::error('NO_KARYAWAN', 'Akun ini tidak terhubung ke data karyawan', null, 404);
        }
        return $this->daftar($karyawanId);
    }

    public function show($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Pengajuan tidak ditemukan', null, 404);
        }
        if (! $this->isAdmin() && (int) $row['karyawan_id'] !== $this->karyawanIdSaatIni()) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }
        return ApiResponse::success(PengajuanIzinModel::format($row), 'Detail pengajuan');
    }

    public function create()
    {
        $karyawanId = $this->karyawanIdSaatIni();
        if (! $karyawanId) {
            return ApiResponse::error('NO_KARYAWAN', 'Akun ini tidak terhubung ke data karyawan', null, 404);
        }

        $in = $this->request->getJSON(true) ?? [];
        $validation = service('validation')->setRules([
            'jenis'           => 'required|in_list[izin,sakit,cuti,koreksi_absensi,lembur]',
            'tanggal_mulai'   => 'required|valid_date[Y-m-d]',
            'tanggal_selesai' => 'required|valid_date[Y-m-d]',
            'alasan'          => 'permit_empty|string',
            'lampiran_path'   => 'permit_empty|max_length[255]',
        ]);
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Validasi gagal', $validation->getErrors(), 422);
        }

        $jenis   = $in['jenis'];
        $mulai   = $in['tanggal_mulai'];
        $selesai = $in['tanggal_selesai'];

        if ($selesai < $mulai) {
            return ApiResponse::error('VALIDATION_ERROR', 'Tanggal selesai tidak boleh sebelum tanggal mulai', null, 422);
        }

        $jumlahHari = 0.0;
        $dataJson   = null;

        if (in_array($jenis, PengajuanIzinModel::JENIS_HARI, true)) {
            if (substr($mulai, 0, 4) !== substr($selesai, 0, 4)) {
                return ApiResponse::error('VALIDATION_ERROR', 'Pengajuan lintas tahun harus dipisah per tahun', null, 422);
            }

            $jumlahHari = $this->model->hitungHariKerja($mulai, $selesai);
            if ($jumlahHari <= 0) {
                return ApiResponse::error('VALIDATION_ERROR', 'Rentang tanggal tidak berisi hari kerja', null, 422);
            }

            if ($this->model->adaTumpangTindih($karyawanId, $mulai, $selesai)) {
                return ApiResponse::error('CONFLICT', 'Tanggal bertumpuk dengan pengajuan lain yang masih aktif', null, 409);
            }

            if ($jenis === 'cuti') {
                $kuota = (new KuotaCutiModel())->ambilAtauBuat($karyawanId, (int) substr($mulai, 0, 4));
                $sisa  = (float) $kuota['total'] - (float) $kuota['terpakai'];
                if ($jumlahHari > $sisa) {
                    return ApiResponse::error(
                        'KUOTA_TIDAK_CUKUP',
                        "Sisa kuota cuti tidak cukup (sisa {$sisa} hari, diminta {$jumlahHari} hari)",
                        null,
                        422
                    );
                }
            }
        } else {
            // koreksi_absensi / lembur: detail wajib di data_json
            if (empty($in['data_json']) || ! is_array($in['data_json'])) {
                return ApiResponse::error('VALIDATION_ERROR', 'data_json wajib diisi untuk jenis ' . $jenis, null, 422);
            }
            $dataJson = json_encode($in['data_json']);
        }

        $id = $this->model->insert([
            'karyawan_id'     => $karyawanId,
            'jenis'           => $jenis,
            'tanggal_mulai'   => $mulai,
            'tanggal_selesai' => $selesai,
            'jumlah_hari'     => $jumlahHari,
            'alasan'          => $in['alasan'] ?? null,
            'lampiran_path'   => $in['lampiran_path'] ?? null,
            'data_json'       => $dataJson,
            'status'          => 'menunggu',
        ]);

        return ApiResponse::success(
            PengajuanIzinModel::format($this->model->find($id)),
            'Pengajuan berhasil dibuat',
            null,
            201
        );
    }

    /** Karyawan membatalkan pengajuannya sendiri (hanya saat masih menunggu) */
    public function batalkan($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Pengajuan tidak ditemukan', null, 404);
        }
        if ((int) $row['karyawan_id'] !== $this->karyawanIdSaatIni()) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }
        if ($row['status'] !== 'menunggu') {
            return ApiResponse::error('UNPROCESSABLE', 'Hanya pengajuan berstatus menunggu yang bisa dibatalkan', null, 422);
        }

        $this->model->update($id, ['status' => 'dibatalkan']);
        return ApiResponse::success(PengajuanIzinModel::format($this->model->find($id)), 'Pengajuan dibatalkan');
    }

    /** Admin: setujui. Untuk cuti, kuota dipotong dalam satu transaksi. */
    public function setujui($id = null)
    {
        $db = db_connect();
        $db->transBegin();

        try {
            $p = $db->query('SELECT * FROM pengajuan_izin WHERE id = ? FOR UPDATE', [(int) $id])->getRowArray();

            if (! $p) {
                $db->transRollback();
                return ApiResponse::error('NOT_FOUND', 'Pengajuan tidak ditemukan', null, 404);
            }
            if ($p['status'] !== 'menunggu') {
                $db->transRollback();
                return ApiResponse::error('UNPROCESSABLE', 'Pengajuan sudah diproses (' . $p['status'] . ')', null, 422);
            }

            if ($p['jenis'] === 'cuti') {
                $tahun = (int) substr($p['tanggal_mulai'], 0, 4);
                $kuota = (new KuotaCutiModel())->ambilAtauBuat((int) $p['karyawan_id'], $tahun);
                $kuota = $db->query('SELECT * FROM kuota_cuti WHERE id = ? FOR UPDATE', [$kuota['id']])->getRowArray();

                $sisa = (float) $kuota['total'] - (float) $kuota['terpakai'];
                if ((float) $p['jumlah_hari'] > $sisa) {
                    $db->transRollback();
                    return ApiResponse::error('KUOTA_TIDAK_CUKUP', "Sisa kuota karyawan tidak cukup (sisa {$sisa} hari)", null, 422);
                }

                $db->query(
                    'UPDATE kuota_cuti SET terpakai = terpakai + ?, updated_at = ? WHERE id = ?',
                    [$p['jumlah_hari'], date('Y-m-d H:i:s'), $kuota['id']]
                );
            }

            $this->model->update($id, [
                'status'        => 'disetujui',
                'diproses_oleh' => $this->userId(),
                'diproses_pada' => date('Y-m-d H:i:s'),
            ]);

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal setujui pengajuan: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Terjadi kesalahan saat memproses persetujuan', null, 500);
        }

        return ApiResponse::success(PengajuanIzinModel::format($this->model->find($id)), 'Pengajuan disetujui');
    }

    /** Admin: tolak (alasan wajib) */
    public function tolak($id = null)
    {
        $in = $this->request->getJSON(true) ?? [];
        $validation = service('validation')->setRules([
            'alasan_penolakan' => 'required|max_length[255]',
        ]);
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Validasi gagal', $validation->getErrors(), 422);
        }

        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Pengajuan tidak ditemukan', null, 404);
        }
        if ($row['status'] !== 'menunggu') {
            return ApiResponse::error('UNPROCESSABLE', 'Pengajuan sudah diproses (' . $row['status'] . ')', null, 422);
        }

        $this->model->update($id, [
            'status'           => 'ditolak',
            'alasan_penolakan' => $in['alasan_penolakan'],
            'diproses_oleh'    => $this->userId(),
            'diproses_pada'    => date('Y-m-d H:i:s'),
        ]);

        return ApiResponse::success(PengajuanIzinModel::format($this->model->find($id)), 'Pengajuan ditolak');
    }

    // ---------- helper ----------

    private function daftar(?int $karyawanId)
    {
        $perPage = min(max((int) ($this->request->getGet('per_page') ?: 10), 1), 100);

        $m = $this->model
            ->select('pengajuan_izin.*, karyawan.nama AS karyawan_nama')
            ->join('karyawan', 'karyawan.id = pengajuan_izin.karyawan_id');

        if ($karyawanId) {
            $m->where('pengajuan_izin.karyawan_id', $karyawanId);
        } elseif ($kid = $this->request->getGet('karyawan_id')) {
            $m->where('pengajuan_izin.karyawan_id', (int) $kid);
        }
        if ($s = $this->request->getGet('status')) $m->where('pengajuan_izin.status', $s);
        if ($j = $this->request->getGet('jenis'))  $m->where('pengajuan_izin.jenis', $j);
        if ($d = $this->request->getGet('dari'))   $m->where('pengajuan_izin.tanggal_selesai >=', $d);
        if ($k = $this->request->getGet('sampai')) $m->where('pengajuan_izin.tanggal_mulai <=', $k);

        $rows = $m->orderBy('pengajuan_izin.created_at', 'DESC')->paginate($perPage);

        return ApiResponse::success(
            array_map([PengajuanIzinModel::class, 'format'], $rows),
            'Daftar pengajuan',
            [
                'page'        => $m->pager->getCurrentPage(),
                'per_page'    => $perPage,
                'total'       => $m->pager->getTotal(),
                'total_pages' => $m->pager->getPageCount(),
            ]
        );
    }

    private function userId(): int
    {
        return (int) ((JwtService::$user ?? [])['id'] ?? 0);
    }

    private function isAdmin(): bool
    {
        return ((JwtService::$user ?? [])['role'] ?? '') === 'admin_hrd';
    }

    private function karyawanIdSaatIni(): ?int
    {
        $u = JwtService::$user ?? [];
        return ! empty($u['karyawan_id']) ? (int) $u['karyawan_id'] : null;
    }
}