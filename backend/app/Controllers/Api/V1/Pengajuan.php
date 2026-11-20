<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Libraries\Tanggal;
use App\Models\KuotaCutiModel;
use App\Models\NotifikasiModel;
use App\Models\PengajuanIzinModel;
use App\Services\AttendanceService;
use App\Services\PayrollService;

/**
 * Pengajuan izin, sakit, cuti, koreksi absensi, dan lembur (kontrak bagian 6).
 */
class Pengajuan extends BaseController
{
    private const JENIS  = ['izin', 'sakit', 'cuti', 'koreksi_absensi', 'lembur'];
    private const STATUS = ['menunggu', 'disetujui', 'ditolak', 'dibatalkan'];
    private const JUDUL  = [
        'izin' => 'Izin', 'sakit' => 'Sakit', 'cuti' => 'Cuti tahunan',
        'koreksi_absensi' => 'Koreksi absensi', 'lembur' => 'Lembur',
    ];
    private const LABEL_ROLE = ['admin_hrd' => 'HRD', 'keuangan' => 'Keuangan', 'pemilik' => 'Pemilik', 'karyawan' => 'Karyawan'];

    private PengajuanIzinModel $model;

    public function __construct()
    {
        $this->model = new PengajuanIzinModel();
    }

    // GET /api/v1/pengajuan?jenis=&status=&departemen_id=&search=&tanggal_dari=&tanggal_sampai=&page=1&per_page=10
    public function index()
    {
        $admin = $this->isAdmin();
        $kid   = $this->karyawanId();
        if (! $admin && ! $kid) {
            return $this->tanpaKaryawan();
        }

        $db      = db_connect();
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $jenis   = (string) $this->request->getGet('jenis');
        $status  = (string) $this->request->getGet('status');
        $dept    = (int) $this->request->getGet('departemen_id');
        $q       = trim((string) $this->request->getGet('search'));
        $dari    = $this->tglGet('tanggal_dari');
        $sampai  = $this->tglGet('tanggal_sampai');
        $kidGet  = (int) $this->request->getGet('karyawan_id');

        $dasar = static function (bool $denganStatus) use ($db, $admin, $kid, $kidGet, $jenis, $status, $dept, $q, $dari, $sampai) {
            $b = $db->table('pengajuan_izin p')
                ->join('karyawan k', 'k.id = p.karyawan_id')
                ->join('departemen d', 'd.id = k.departemen_id', 'left');

            if (! $admin) {
                $b->where('p.karyawan_id', $kid);
            } elseif ($kidGet > 0) {
                $b->where('p.karyawan_id', $kidGet);
            }
            if (in_array($jenis, self::JENIS, true)) {
                $b->where('p.jenis', $jenis);
            }
            if ($dept > 0) {
                $b->where('k.departemen_id', $dept);
            }
            if ($q !== '') {
                $b->groupStart()->like('k.nama', $q)->orLike('p.alasan', $q)->groupEnd();
            }
            if ($dari) {
                $b->where('p.tanggal_selesai >=', $dari);
            }
            if ($sampai) {
                $b->where('p.tanggal_mulai <=', $sampai);
            }
            if ($denganStatus) {
                if (in_array($status, self::STATUS, true)) {
                    $b->where('p.status', $status);
                } else {
                    $b->where('p.status !=', 'dibatalkan');
                }
            }
            return $b;
        };

        $total = $dasar(true)->countAllResults();

        $rows = $dasar(true)
            ->select('p.*, k.nama AS karyawan_nama, d.nama AS departemen_nama')
            ->orderBy('p.created_at', 'DESC')->orderBy('p.id', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        $ringkasan = ['menunggu' => 0, 'disetujui' => 0, 'ditolak' => 0];
        $hitung    = $dasar(false)->select('p.status, COUNT(*) AS n', false)->groupBy('p.status')->get()->getResultArray();
        foreach ($hitung as $c) {
            if (isset($ringkasan[$c['status']])) {
                $ringkasan[$c['status']] = (int) $c['n'];
            }
        }

        return ApiResponse::success($this->bentuk($rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ], 200, ['ringkasan' => $ringkasan]);
    }

    // GET /api/v1/pengajuan/kuota?tahun=2026
    public function kuota()
    {
        $kid = $this->karyawanId();
        if (! $kid) {
            return $this->tanpaKaryawan();
        }

        $tahun = (int) ($this->request->getGet('tahun') ?: date('Y'));
        $k     = (new KuotaCutiModel())->ambilAtauBuat($kid, $tahun);
        $total = (float) $k['total'];
        $pakai = (float) $k['terpakai'];

        return ApiResponse::success([
            'tahun'              => $tahun,
            'cuti_tahunan_total' => $total,
            'cuti_terpakai'      => $pakai,
            'cuti_sisa'          => $total - $pakai,
        ]);
    }

    // GET /api/v1/pengajuan/(:num)
    public function show($id = null)
    {
        $row = $this->ambil((int) $id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Pengajuan tidak ditemukan', null, 404);
        }
        if (! $this->boleh($row)) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }
        return ApiResponse::success($this->bentuk([$row])[0]);
    }

    // GET /api/v1/pengajuan/(:num)/lampiran
    public function lampiran($id = null)
    {
        $row = $this->model->find($id);
        if (! $row || empty($row['lampiran_path'])) {
            return ApiResponse::error('NOT_FOUND', 'Lampiran tidak ditemukan', null, 404);
        }
        if (! $this->boleh($row)) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }

        $full = WRITEPATH . ltrim($row['lampiran_path'], '/\\');
        if (! is_file($full)) {
            return ApiResponse::error('NOT_FOUND', 'Berkas lampiran tidak ditemukan', null, 404);
        }
        return $this->response->download($full, null);
    }

    // POST /api/v1/pengajuan   (JSON atau multipart/form-data dengan file "lampiran")
    public function create()
    {
        $kid = $this->karyawanId();
        if (! $kid) {
            return $this->tanpaKaryawan();
        }

        $in      = $this->input();
        $jenis   = (string) ($in['jenis'] ?? '');
        $mulai   = (string) ($in['tanggal_mulai'] ?? '');
        $selesai = (string) ($in['tanggal_selesai'] ?? '');
        $alasan  = isset($in['alasan']) ? trim((string) $in['alasan']) : null;

        $errors = [];
        if (! in_array($jenis, self::JENIS, true)) {
            $errors['jenis'] = 'Jenis pengajuan tidak valid';
        }
        if (! $this->tglValid($mulai)) {
            $errors['tanggal_mulai'] = 'Tanggal mulai wajib berformat YYYY-MM-DD';
        }

        $hariBiasa = in_array($jenis, PengajuanIzinModel::JENIS_HARI, true);
        if ($hariBiasa) {
            if (! $this->tglValid($selesai)) {
                $errors['tanggal_selesai'] = 'Tanggal selesai wajib berformat YYYY-MM-DD';
            }
        } else {
            $selesai = $mulai; // koreksi dan lembur selalu satu hari
        }
        if ($alasan !== null && mb_strlen($alasan) > 2000) {
            $errors['alasan'] = 'Alasan maksimal 2000 karakter';
        }
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $jumlahHari = 0.0;
        $dataJson   = null;

        if ($hariBiasa) {
            if ($selesai < $mulai) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal_selesai' => 'Tanggal selesai tidak boleh sebelum tanggal mulai'], 422);
            }
            if (substr($mulai, 0, 4) !== substr($selesai, 0, 4)) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal_selesai' => 'Pengajuan lintas tahun harus dipisah per tahun'], 422);
            }

            $jumlahHari = (float) count((new PayrollService())->hariKerja($mulai, $selesai));
            if ($jumlahHari <= 0) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal_mulai' => 'Rentang tanggal tidak berisi hari kerja'], 422);
            }
            if ($this->model->adaTumpangTindih($kid, $mulai, $selesai)) {
                return ApiResponse::error('CONFLICT', 'Tanggal bertumpuk dengan pengajuan lain yang masih aktif', null, 409);
            }
            if ($jenis === 'cuti') {
                $k    = (new KuotaCutiModel())->ambilAtauBuat($kid, (int) substr($mulai, 0, 4));
                $sisa = (float) $k['total'] - (float) $k['terpakai'];
                if ($jumlahHari > $sisa) {
                    return ApiResponse::error('INSUFFICIENT_LEAVE_QUOTA', "Sisa kuota cuti tidak cukup (sisa {$sisa} hari, diminta {$jumlahHari} hari)", null, 422);
                }
            }
        } elseif ($jenis === 'koreksi_absensi') {
            $masuk  = trim((string) ($in['jam_masuk_benar'] ?? ''));
            $pulang = trim((string) ($in['jam_pulang_benar'] ?? ''));

            if ($masuk === '' && $pulang === '') {
                $errors['jam_masuk_benar'] = 'Isi jam masuk atau jam pulang yang benar';
            }
            if ($masuk !== '' && ! $this->jamValid($masuk)) {
                $errors['jam_masuk_benar'] = 'Format jam masuk harus HH:mm';
            }
            if ($pulang !== '' && ! $this->jamValid($pulang)) {
                $errors['jam_pulang_benar'] = 'Format jam pulang harus HH:mm';
            }
            if (! $errors && $masuk !== '' && $pulang !== '' && substr($pulang, 0, 5) <= substr($masuk, 0, 5)) {
                $errors['jam_pulang_benar'] = 'Jam pulang harus setelah jam masuk';
            }
            if ($mulai > date('Y-m-d')) {
                $errors['tanggal_mulai'] = 'Tanggal koreksi tidak boleh di masa depan';
            }
            if ($errors) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
            }
            if ($this->adaDuplikat($kid, $jenis, $mulai)) {
                return ApiResponse::error('CONFLICT', 'Sudah ada pengajuan koreksi untuk tanggal ini', null, 409);
            }

            $dataJson = json_encode([
                'jam_masuk_benar'  => $masuk !== '' ? substr($masuk, 0, 5) : null,
                'jam_pulang_benar' => $pulang !== '' ? substr($pulang, 0, 5) : null,
            ]);
        } else { // lembur
            $jm = trim((string) ($in['jam_mulai'] ?? ''));
            $js = trim((string) ($in['jam_selesai'] ?? ''));

            if (! $this->jamValid($jm)) {
                $errors['jam_mulai'] = 'Jam mulai wajib berformat HH:mm';
            }
            if (! $this->jamValid($js)) {
                $errors['jam_selesai'] = 'Jam selesai wajib berformat HH:mm';
            }
            if (! $errors && substr($js, 0, 5) <= substr($jm, 0, 5)) {
                $errors['jam_selesai'] = 'Jam selesai harus setelah jam mulai';
            }
            if ($errors) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
            }
            if ($this->adaDuplikat($kid, $jenis, $mulai)) {
                return ApiResponse::error('CONFLICT', 'Sudah ada pengajuan lembur untuk tanggal ini', null, 409);
            }

            $durasi   = intdiv(strtotime($mulai . ' ' . substr($js, 0, 5)) - strtotime($mulai . ' ' . substr($jm, 0, 5)), 60);
            $dataJson = json_encode(['jam_mulai' => substr($jm, 0, 5), 'jam_selesai' => substr($js, 0, 5), 'durasi_menit' => $durasi]);
        }

        // lampiran (opsional)
        $lampiranPath = null;
        $file         = $this->request->getFile('lampiran');
        if ($file && $file->getError() !== UPLOAD_ERR_NO_FILE) {
            $ext = strtolower($file->getClientExtension());
            if (! $file->isValid() || $file->hasMoved()) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['lampiran' => 'Upload lampiran gagal'], 422);
            }
            if (! in_array($ext, ['pdf', 'jpg', 'jpeg', 'png'], true)) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['lampiran' => 'Lampiran harus berupa PDF, JPG, atau PNG'], 422);
            }
            if ($file->getSize() > 2 * 1024 * 1024) {
                return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['lampiran' => 'Ukuran lampiran maksimal 2 MB'], 422);
            }
            $nama = bin2hex(random_bytes(12)) . '.' . $ext;
            $file->move(WRITEPATH . 'uploads/lampiran', $nama);
            $lampiranPath = 'uploads/lampiran/' . $nama;
        }

        $id = $this->model->insert([
            'karyawan_id'     => $kid,
            'jenis'           => $jenis,
            'tanggal_mulai'   => $mulai,
            'tanggal_selesai' => $selesai,
            'jumlah_hari'     => $jumlahHari,
            'alasan'          => $alasan,
            'lampiran_path'   => $lampiranPath,
            'data_json'       => $dataJson,
            'status'          => 'menunggu',
        ], true);

        $this->aman(function () use ($id, $kid, $jenis, $mulai, $selesai) {
            $nama = (db_connect()->table('karyawan')->select('nama')->where('id', $kid)->get()->getRowArray()['nama'] ?? 'Karyawan');
            NotifikasiModel::kirimKeRole(
                'admin_hrd',
                'Pengajuan ' . strtolower(self::JUDUL[$jenis]) . ' baru',
                $nama . ' mengajukan ' . strtolower(self::JUDUL[$jenis]) . ' ' . $this->rentang($mulai, $selesai),
                'pengajuan',
                '/app/pengajuan?id=' . $id
            );
        });

        return ApiResponse::success($this->bentuk([$this->ambil((int) $id)])[0], 'Pengajuan berhasil dibuat', null, 201);
    }

    // POST /api/v1/pengajuan/(:num)/setujui   (admin_hrd)
    public function setujui($id = null)
    {
        $err = $this->prosesSetuju((int) $id);
        if ($err) {
            return ApiResponse::error($err[0], $err[1], null, $err[2]);
        }

        $this->aman(fn () => $this->notifProses((int) $id, true, null));

        return ApiResponse::success($this->bentuk([$this->ambil((int) $id)])[0], 'Pengajuan disetujui');
    }

    // POST /api/v1/pengajuan/(:num)/tolak   (admin_hrd)   body: {"alasan_penolakan":"..."}
    public function tolak($id = null)
    {
        $in     = $this->body();
        $alasan = trim((string) ($in['alasan_penolakan'] ?? ''));
        if ($alasan === '' || mb_strlen($alasan) > 255) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['alasan_penolakan' => 'Alasan penolakan wajib diisi (maksimal 255 karakter)'], 422);
        }

        $err = $this->prosesTolak((int) $id, $alasan);
        if ($err) {
            return ApiResponse::error($err[0], $err[1], null, $err[2]);
        }

        $this->aman(fn () => $this->notifProses((int) $id, false, $alasan));

        return ApiResponse::success($this->bentuk([$this->ambil((int) $id)])[0], 'Pengajuan ditolak');
    }

    // POST /api/v1/pengajuan/bulk-proses   body: {"ids":[31,32], "aksi":"setujui"|"tolak", "alasan_penolakan"?}
    public function bulkProses()
    {
        $in     = $this->body();
        $ids    = $in['ids'] ?? null;
        $aksi   = (string) ($in['aksi'] ?? '');
        $alasan = trim((string) ($in['alasan_penolakan'] ?? ''));

        $errors = [];
        if (! is_array($ids) || ! $ids || count($ids) > 100) {
            $errors['ids'] = 'ids wajib berupa daftar 1 sampai 100 id pengajuan';
        }
        if (! in_array($aksi, ['setujui', 'tolak'], true)) {
            $errors['aksi'] = 'aksi harus setujui atau tolak';
        }
        if ($aksi === 'tolak' && $alasan === '') {
            $errors['alasan_penolakan'] = 'Alasan penolakan wajib diisi';
        }
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }

        $berhasil = [];
        $gagal    = [];
        foreach (array_unique(array_map('intval', $ids)) as $id) {
            $err = $aksi === 'setujui' ? $this->prosesSetuju($id) : $this->prosesTolak($id, mb_substr($alasan, 0, 255));
            if ($err) {
                $gagal[] = ['id' => $id, 'alasan' => $err[1]];
            } else {
                $berhasil[] = $id;
                $this->aman(fn () => $this->notifProses($id, $aksi === 'setujui', $alasan));
            }
        }

        return ApiResponse::success(['berhasil' => $berhasil, 'gagal' => $gagal], 'Pengajuan diproses');
    }

    // DELETE /api/v1/pengajuan/(:num)   pemilik pengajuan, hanya saat masih menunggu
    public function delete($id = null)
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Pengajuan tidak ditemukan', null, 404);
        }
        if ((int) $row['karyawan_id'] !== (int) $this->karyawanId()) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }
        if ($row['status'] !== 'menunggu') {
            return ApiResponse::error('CONFLICT', 'Hanya pengajuan berstatus menunggu yang bisa dibatalkan', null, 409);
        }

        $this->model->update($id, ['status' => 'dibatalkan']);
        return ApiResponse::success(null, 'Pengajuan dibatalkan');
    }

    // ================= proses persetujuan =================

    /** @return array{0:string,1:string,2:int}|null  null = berhasil */
    private function prosesSetuju(int $id): ?array
    {
        $db = db_connect();
        $db->transBegin();

        try {
            $p = $db->query('SELECT * FROM pengajuan_izin WHERE id = ? FOR UPDATE', [$id])->getRowArray();
            if (! $p) {
                $db->transRollback();
                return ['NOT_FOUND', 'Pengajuan tidak ditemukan', 404];
            }
            if ($p['status'] !== 'menunggu') {
                $db->transRollback();
                return ['CONFLICT', 'Pengajuan sudah diproses (' . $p['status'] . ')', 409];
            }

            if ($err = $this->terapkanEfek($db, $p)) {
                $db->transRollback();
                return $err;
            }

            $now = date('Y-m-d H:i:s');
            $db->table('pengajuan_izin')->where('id', $id)->update([
                'status'        => 'disetujui',
                'diproses_oleh' => $this->userId(),
                'diproses_pada' => $now,
                'updated_at'    => $now,
            ]);

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal setujui pengajuan: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            return ['SERVER_ERROR', 'Terjadi kesalahan saat memproses persetujuan', 500];
        }

        return null;
    }

    /** @return array{0:string,1:string,2:int}|null */
    private function prosesTolak(int $id, string $alasan): ?array
    {
        $row = $this->model->find($id);
        if (! $row) {
            return ['NOT_FOUND', 'Pengajuan tidak ditemukan', 404];
        }
        if ($row['status'] !== 'menunggu') {
            return ['CONFLICT', 'Pengajuan sudah diproses (' . $row['status'] . ')', 409];
        }

        $this->model->update($id, [
            'status'           => 'ditolak',
            'alasan_penolakan' => $alasan,
            'diproses_oleh'    => $this->userId(),
            'diproses_pada'    => date('Y-m-d H:i:s'),
        ]);
        return null;
    }

    /**
     * Efek persetujuan (dalam transaksi):
     *  - cuti: kuota dipotong
     *  - izin, sakit, cuti: baris absensi dibuat untuk tiap hari kerja (tanggal yang sudah punya absensi dilewati)
     *  - koreksi_absensi: jam masuk dan pulang absensi diperbarui, status dan keterlambatan dihitung ulang
     *  - lembur: lembur_menit absensi diisi
     *
     * @return array{0:string,1:string,2:int}|null
     */
    private function terapkanEfek($db, array $p): ?array
    {
        $kid = (int) $p['karyawan_id'];
        $now = date('Y-m-d H:i:s');

        if ($p['jenis'] === 'koreksi_absensi') {
            return $this->efekKoreksi($db, $p, $now);
        }
        if ($p['jenis'] === 'lembur') {
            return $this->efekLembur($db, $p, $now);
        }

        if ($p['jenis'] === 'cuti') {
            $kuota = (new KuotaCutiModel())->ambilAtauBuat($kid, (int) substr($p['tanggal_mulai'], 0, 4));
            $kuota = $db->query('SELECT * FROM kuota_cuti WHERE id = ? FOR UPDATE', [$kuota['id']])->getRowArray();
            $sisa  = (float) $kuota['total'] - (float) $kuota['terpakai'];
            if ((float) $p['jumlah_hari'] > $sisa) {
                return ['INSUFFICIENT_LEAVE_QUOTA', "Sisa kuota karyawan tidak cukup (sisa {$sisa} hari)", 422];
            }
            $db->query('UPDATE kuota_cuti SET terpakai = terpakai + ?, updated_at = ? WHERE id = ?', [$p['jumlah_hari'], $now, $kuota['id']]);
        }

        $hari = (new PayrollService())->hariKerja($p['tanggal_mulai'], $p['tanggal_selesai']);
        if ($hari) {
            $ada = array_column(
                $db->table('absensi')->select('tanggal')
                    ->where('karyawan_id', $kid)
                    ->where('tanggal >=', $p['tanggal_mulai'])->where('tanggal <=', $p['tanggal_selesai'])
                    ->get()->getResultArray(),
                'tanggal'
            );
            $batch = [];
            foreach ($hari as $t) {
                if (in_array($t, $ada, true)) {
                    continue;
                }
                $batch[] = [
                    'karyawan_id'     => $kid,
                    'tanggal'         => $t,
                    'jam_masuk'       => null,
                    'jam_pulang'      => null,
                    'status'          => $p['jenis'],
                    'menit_terlambat' => 0,
                    'durasi_menit'    => null,
                    'lembur_menit'    => 0,
                    'sumber'          => 'sistem',
                    'pengajuan_id'    => (int) $p['id'],
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ];
            }
            if ($batch) {
                $db->table('absensi')->insertBatch($batch);
            }
        }

        return null;
    }

    private function efekKoreksi($db, array $p, string $now): ?array
    {
        $d   = $p['data_json'] ? (json_decode($p['data_json'], true) ?: []) : [];
        $tgl = $p['tanggal_mulai'];
        $kid = (int) $p['karyawan_id'];
        $row = $db->table('absensi')->where('karyawan_id', $kid)->where('tanggal', $tgl)->get()->getRowArray();

        $masuk  = ! empty($d['jam_masuk_benar']) ? $this->jamPenuh($d['jam_masuk_benar']) : ($row['jam_masuk'] ?? null);
        $pulang = ! empty($d['jam_pulang_benar']) ? $this->jamPenuh($d['jam_pulang_benar']) : ($row['jam_pulang'] ?? null);

        if ($masuk === null) {
            return ['UNPROCESSABLE', 'Tidak ada data jam masuk pada tanggal tersebut untuk dikoreksi', 422];
        }

        $jadwal  = (new AttendanceService())->jadwal();
        $selisih = strtotime($tgl . ' ' . $masuk) - strtotime($tgl . ' ' . $jadwal['jam_masuk']);
        $telat   = $selisih > ((int) $jadwal['toleransi_menit']) * 60;

        $data = [
            'jam_masuk'       => $masuk,
            'jam_pulang'      => $pulang,
            'status'          => $telat ? 'terlambat' : 'hadir',
            'menit_terlambat' => $telat ? intdiv($selisih, 60) : 0,
            'durasi_menit'    => $pulang !== null ? max(0, intdiv(strtotime($tgl . ' ' . $pulang) - strtotime($tgl . ' ' . $masuk), 60)) : null,
            'sumber'          => 'koreksi',
            'pengajuan_id'    => (int) $p['id'],
            'updated_at'      => $now,
        ];

        if ($row) {
            $db->table('absensi')->where('id', $row['id'])->update($data);
        } else {
            $db->table('absensi')->insert($data + ['karyawan_id' => $kid, 'tanggal' => $tgl, 'lembur_menit' => 0, 'created_at' => $now]);
        }
        return null;
    }

    private function efekLembur($db, array $p, string $now): ?array
    {
        $d      = $p['data_json'] ? (json_decode($p['data_json'], true) ?: []) : [];
        $tgl    = $p['tanggal_mulai'];
        $kid    = (int) $p['karyawan_id'];
        $durasi = (int) ($d['durasi_menit'] ?? 0);
        $row    = $db->table('absensi')->where('karyawan_id', $kid)->where('tanggal', $tgl)->get()->getRowArray();

        if ($row) {
            $db->table('absensi')->where('id', $row['id'])->update(['lembur_menit' => $durasi, 'updated_at' => $now]);
            return null;
        }

        // Hari kerja tanpa data absensi: jangan jadikan hadir lewat lembur
        if (count((new PayrollService())->hariKerja($tgl, $tgl)) > 0) {
            return ['UNPROCESSABLE', 'Belum ada data absensi pada tanggal lembur. Selesaikan koreksi absensi terlebih dahulu', 422];
        }

        // Hari libur atau akhir pekan: catat kehadiran lembur
        $db->table('absensi')->insert([
            'karyawan_id'     => $kid,
            'tanggal'         => $tgl,
            'jam_masuk'       => $this->jamPenuh($d['jam_mulai'] ?? '00:00'),
            'jam_pulang'      => $this->jamPenuh($d['jam_selesai'] ?? '00:00'),
            'status'          => 'hadir',
            'menit_terlambat' => 0,
            'durasi_menit'    => $durasi,
            'lembur_menit'    => $durasi,
            'sumber'          => 'sistem',
            'pengajuan_id'    => (int) $p['id'],
            'created_at'      => $now,
            'updated_at'      => $now,
        ]);
        return null;
    }

    // ================= notifikasi =================

    private function notifProses(int $id, bool $setuju, ?string $alasan): void
    {
        $row = $this->ambil($id);
        if (! $row) {
            return;
        }
        $u = db_connect()->table('users')->select('id')->where('karyawan_id', (int) $row['karyawan_id'])->where('aktif', 1)->get()->getRowArray();
        if (! $u) {
            return;
        }

        $judul   = strtolower(self::JUDUL[$row['jenis']] ?? $row['jenis']);
        $rentang = $this->rentang($row['tanggal_mulai'], $row['tanggal_selesai']);

        NotifikasiModel::kirim(
            (int) $u['id'],
            $setuju ? 'Pengajuan disetujui' : 'Pengajuan ditolak',
            $setuju ? "Pengajuan {$judul} {$rentang} disetujui" : "Pengajuan {$judul} {$rentang} ditolak: {$alasan}",
            'pengajuan',
            '/app/pengajuan?id=' . $id
        );
    }

    // ================= helper =================

    private function ambil(int $id): ?array
    {
        return db_connect()->table('pengajuan_izin p')
            ->select('p.*, k.nama AS karyawan_nama, d.nama AS departemen_nama')
            ->join('karyawan k', 'k.id = p.karyawan_id')
            ->join('departemen d', 'd.id = k.departemen_id', 'left')
            ->where('p.id', $id)
            ->get()->getRowArray();
    }

    /** @param list<array<string,mixed>> $rows */
    private function bentuk(array $rows): array
    {
        $ids   = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) ($r['diproses_oleh'] ?? 0), $rows))));
        $users = [];
        if ($ids) {
            foreach (db_connect()->table('users')->select('id, nama, role')->whereIn('id', $ids)->get()->getResultArray() as $u) {
                $users[(int) $u['id']] = $u;
            }
        }

        return array_map(function ($r) use ($users) {
            $dp = null;
            if (! empty($r['diproses_oleh']) && isset($users[(int) $r['diproses_oleh']])) {
                $u  = $users[(int) $r['diproses_oleh']];
                $dp = ['id' => (int) $u['id'], 'nama' => $u['nama'], 'label' => $u['nama'] . ' (' . (self::LABEL_ROLE[$u['role']] ?? $u['role']) . ')'];
            }

            $kata    = preg_split('/\s+/', trim($r['karyawan_nama']));
            $inisial = strtoupper(mb_substr($kata[0], 0, 1) . (isset($kata[1]) ? mb_substr($kata[1], 0, 1) : ''));

            $out = [
                'id'      => (int) $r['id'],
                'jenis'   => $r['jenis'],
                'judul'   => self::JUDUL[$r['jenis']] ?? $r['jenis'],
                'karyawan' => [
                    'id'         => (int) $r['karyawan_id'],
                    'nama'       => $r['karyawan_nama'],
                    'inisial'    => $inisial,
                    'departemen' => $r['departemen_nama'],
                ],
                'tanggal_mulai'    => $r['tanggal_mulai'],
                'tanggal_selesai'  => $r['tanggal_selesai'],
                'jumlah_hari'      => (float) $r['jumlah_hari'],
                'alasan'           => $r['alasan'],
                'lampiran_url'     => ! empty($r['lampiran_path']) ? base_url('api/v1/pengajuan/' . $r['id'] . '/lampiran') : null,
                'status'           => $r['status'],
                'tanggal_diajukan' => substr((string) $r['created_at'], 0, 10),
                'diproses_oleh'    => $dp,
                'diproses_pada'    => Tanggal::waktuIso($r['diproses_pada']),
                'alasan_penolakan' => $r['alasan_penolakan'],
            ];

            $d = $r['data_json'] ? json_decode($r['data_json'], true) : null;
            if ($r['jenis'] === 'koreksi_absensi' && is_array($d)) {
                $out['data_koreksi'] = [
                    'tanggal'          => $r['tanggal_mulai'],
                    'jam_masuk_benar'  => $d['jam_masuk_benar'] ?? null,
                    'jam_pulang_benar' => $d['jam_pulang_benar'] ?? null,
                ];
            }
            if ($r['jenis'] === 'lembur' && is_array($d)) {
                $out['lembur'] = [
                    'tanggal'      => $r['tanggal_mulai'],
                    'jam_mulai'    => $d['jam_mulai'] ?? null,
                    'jam_selesai'  => $d['jam_selesai'] ?? null,
                    'durasi_menit' => (int) ($d['durasi_menit'] ?? 0),
                ];
            }
            return $out;
        }, $rows);
    }

    private function boleh(array $row): bool
    {
        return $this->isAdmin() || (int) $row['karyawan_id'] === (int) $this->karyawanId();
    }

    private function adaDuplikat(int $kid, string $jenis, string $tanggal): bool
    {
        return db_connect()->table('pengajuan_izin')
            ->where('karyawan_id', $kid)->where('jenis', $jenis)->where('tanggal_mulai', $tanggal)
            ->whereIn('status', ['menunggu', 'disetujui'])
            ->countAllResults() > 0;
    }

    private function rentang(string $mulai, string $selesai): string
    {
        return $mulai === $selesai ? $mulai : $mulai . ' s/d ' . $selesai;
    }

    private function tglValid(string $t): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $t)
            && checkdate((int) substr($t, 5, 2), (int) substr($t, 8, 2), (int) substr($t, 0, 4));
    }

    private function tglGet(string $key): ?string
    {
        $v = (string) $this->request->getGet($key);
        return $this->tglValid($v) ? $v : null;
    }

    private function jamValid(string $j): bool
    {
        return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $j);
    }

    private function jamPenuh(string $j): string
    {
        return strlen($j) === 5 ? $j . ':00' : $j;
    }

    private function tanpaKaryawan()
    {
        return ApiResponse::error('FORBIDDEN', 'Akun ini tidak terhubung dengan data karyawan', null, 403);
    }

    private function aman(callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            log_message('error', 'Notifikasi pengajuan gagal: ' . $e->getMessage());
        }
    }

    /** JSON atau form (multipart / urlencoded) */
    private function input(): array
    {
        $ct = strtolower($this->request->getHeaderLine('Content-Type'));
        if (str_contains($ct, 'multipart/form-data') || str_contains($ct, 'application/x-www-form-urlencoded')) {
            return $this->request->getPost() ?? [];
        }
        return $this->body();
    }

    private function body(): array
    {
        try {
            return $this->request->getJSON(true) ?? [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function userId(): int
    {
        return (int) ((JwtService::$user ?? [])['id'] ?? 0);
    }

    private function isAdmin(): bool
    {
        return ((JwtService::$user ?? [])['role'] ?? '') === 'admin_hrd';
    }

    private function karyawanId(): ?int
    {
        $id = (JwtService::$user ?? [])['karyawan_id'] ?? null;
        return $id !== null ? (int) $id : null;
    }
}