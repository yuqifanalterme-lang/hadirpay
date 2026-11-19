<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Models\NotifikasiModel;
use App\Models\PeriodeGajiModel;
use App\Services\PayrollService;

class PeriodeGaji extends BaseController
{
    private PeriodeGajiModel $model;

    public function __construct()
    {
        $this->model = new PeriodeGajiModel();
    }

    // GET /api/v1/periode-gaji?page=1&per_page=10&status=draft&tahun=2026
    public function index()
    {
        $db      = db_connect();
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $status  = (string) $this->request->getGet('status');
        $tahun   = (int) ($this->request->getGet('tahun') ?? 0);

        $filter = static function ($b) use ($status, $tahun) {
            if (in_array($status, PeriodeGajiModel::STATUS, true)) {
                $b->where('p.status', $status);
            }
            if ($tahun > 0) {
                $b->like('p.periode', $tahun . '-', 'after');
            }
            return $b;
        };

        $total = $filter($db->table('periode_gaji p'))->countAllResults();

        $rows = $filter(
            $db->table('periode_gaji p')
                ->select('p.*, COUNT(g.id) AS jumlah_karyawan, COALESCE(SUM(g.total_pendapatan),0) AS total_pendapatan, '
                    . 'COALESCE(SUM(g.total_potongan),0) AS total_potongan, COALESCE(SUM(g.gaji_bersih),0) AS total_gaji_bersih')
                ->join('penggajian g', 'g.periode_gaji_id = p.id', 'left')
        )->groupBy('p.id')->orderBy('p.periode', 'DESC')->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();

        $rows = array_map(static function ($r) {
            $r = PeriodeGajiModel::format($r);
            $r['jumlah_karyawan']   = (int) $r['jumlah_karyawan'];
            $r['total_pendapatan']  = (float) $r['total_pendapatan'];
            $r['total_potongan']    = (float) $r['total_potongan'];
            $r['total_gaji_bersih'] = (float) $r['total_gaji_bersih'];
            return $r;
        }, $rows);

        return ApiResponse::success($rows, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // GET /api/v1/periode-gaji/(:num)
    public function show($id = null)
    {
        $p = $this->model->find($id);
        if (! $p) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }

        $db   = db_connect();
        $ring = $db->table('penggajian')
            ->select('COUNT(id) AS jumlah_karyawan, COALESCE(SUM(total_pendapatan),0) AS total_pendapatan, '
                . 'COALESCE(SUM(total_potongan),0) AS total_potongan, COALESCE(SUM(gaji_bersih),0) AS total_gaji_bersih')
            ->where('periode_gaji_id', (int) $id)
            ->get()->getRowArray();

        $log = $db->table('periode_status_log l')
            ->select('l.status, l.catatan, l.created_at, u.nama AS oleh_nama')
            ->join('users u', 'u.id = l.oleh', 'left')
            ->where('l.periode_gaji_id', (int) $id)
            ->orderBy('l.id', 'ASC')
            ->get()->getResultArray();

        $data = PeriodeGajiModel::format($p);
        $data['ringkasan'] = [
            'jumlah_karyawan'   => (int) $ring['jumlah_karyawan'],
            'total_pendapatan'  => (float) $ring['total_pendapatan'],
            'total_potongan'    => (float) $ring['total_potongan'],
            'total_gaji_bersih' => (float) $ring['total_gaji_bersih'],
        ];
        $data['riwayat_status'] = $log;

        return ApiResponse::success($data);
    }

    // POST /api/v1/periode-gaji   body: {"periode":"2026-11", "tanggal_mulai"?, "tanggal_selesai"?, "tanggal_tutup"?}
    public function create()
    {
        $in = $this->body();

        $periode = trim((string) ($in['periode'] ?? ''));
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periode)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['periode' => 'Periode wajib berformat YYYY-MM'], 422);
        }

        $validation = service('validation');
        $validation->setRules([
            'tanggal_mulai'   => 'permit_empty|valid_date[Y-m-d]',
            'tanggal_selesai' => 'permit_empty|valid_date[Y-m-d]',
            'tanggal_tutup'   => 'permit_empty|valid_date[Y-m-d]',
        ]);
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $mulai   = $in['tanggal_mulai'] ?? ($periode . '-01');
        $selesai = $in['tanggal_selesai'] ?? date('Y-m-t', strtotime($periode . '-01'));
        $tutup   = $in['tanggal_tutup'] ?? $selesai;

        if ($selesai < $mulai) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal_selesai' => 'Tanggal selesai tidak boleh sebelum tanggal mulai'], 422);
        }
        if ($tutup < $selesai) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal_tutup' => 'Tanggal tutup tidak boleh sebelum tanggal selesai'], 422);
        }

        if ($this->model->where('periode', $periode)->countAllResults() > 0) {
            return ApiResponse::error('CONFLICT', "Periode {$periode} sudah ada", null, 409);
        }

        $hariKerja = count((new PayrollService())->hariKerja($mulai, $selesai));

        $db = db_connect();
        $db->transBegin();
        try {
            $id = $this->model->insert([
                'periode'         => $periode,
                'tanggal_mulai'   => $mulai,
                'tanggal_selesai' => $selesai,
                'tanggal_tutup'   => $tutup,
                'hari_kerja'      => $hariKerja,
                'status'          => 'draft',
                'dibuat_oleh'     => $this->userId(),
            ], true);

            $db->table('periode_status_log')->insert([
                'periode_gaji_id' => $id,
                'status'          => 'draft',
                'oleh'            => $this->userId(),
                'catatan'         => 'Periode dibuat',
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal membuat periode gaji: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal membuat periode gaji', null, 500);
        }

        return ApiResponse::success(PeriodeGajiModel::format($this->model->find($id)), 'Periode gaji dibuat', null, 201);
    }

    // DELETE /api/v1/periode-gaji/(:num)   (hanya draft)
    public function delete($id = null)
    {
        $p = $this->model->find($id);
        if (! $p) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }
        if ($p['status'] !== 'draft') {
            return ApiResponse::error('UNPROCESSABLE', 'Hanya periode berstatus draft yang bisa dihapus', null, 422);
        }

        $this->model->delete($id);
        return ApiResponse::success(null, 'Periode gaji dihapus');
    }

    // POST /api/v1/periode-gaji/(:num)/hitung
    public function hitung($id = null)
    {
        $p = $this->model->find($id);
        if (! $p) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }
        if ($p['status'] !== 'draft') {
            return ApiResponse::error('UNPROCESSABLE', 'Hanya periode berstatus draft yang bisa dihitung ulang', null, 422);
        }

        try {
            $hasil = (new PayrollService())->hitungPeriode($p);
        } catch (\Throwable $e) {
            log_message('error', 'Gagal hitung gaji: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menghitung gaji', null, 500);
        }

        return ApiResponse::success($hasil, 'Gaji berhasil dihitung');
    }

    // PUT /api/v1/periode-gaji/(:num)/ajukan   draft -> menunggu_validasi
    public function ajukan($id = null)
    {
        $hasil = $this->transisi((int) $id, 'draft', 'menunggu_validasi', null, [], static function ($p, $db) {
            if (! $p['dihitung_pada']) {
                return ['UNPROCESSABLE', 'Periode belum dihitung', 422];
            }
            if ($db->table('penggajian')->where('periode_gaji_id', $p['id'])->countAllResults() === 0) {
                return ['UNPROCESSABLE', 'Belum ada data penggajian di periode ini', 422];
            }
            return null;
        });
        if (! is_array($hasil)) {
            return $hasil;
        }

        $this->aman(static function () use ($hasil) {
            NotifikasiModel::kirimKeRole('pemilik', 'Penggajian menunggu validasi', "Periode {$hasil['periode']} menunggu validasi Anda.", 'penggajian', '/penggajian/' . $hasil['id']);
        });

        return ApiResponse::success(PeriodeGajiModel::format($hasil), 'Periode diajukan untuk validasi');
    }

    // PUT /api/v1/periode-gaji/(:num)/kembalikan   menunggu_validasi -> draft   body: {"catatan":"..."}
    public function kembalikan($id = null)
    {
        $in = $this->body();
        $validation = service('validation');
        $validation->setRules(['catatan' => 'required|max_length[255]'], ['catatan' => ['required' => 'Catatan pengembalian wajib diisi']]);
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $hasil = $this->transisi((int) $id, 'menunggu_validasi', 'draft', $in['catatan']);
        if (! is_array($hasil)) {
            return $hasil;
        }

        $this->aman(static function () use ($hasil, $in) {
            NotifikasiModel::kirimKeRole('admin_hrd', 'Penggajian dikembalikan', "Periode {$hasil['periode']} dikembalikan: {$in['catatan']}", 'penggajian', '/penggajian/' . $hasil['id']);
        });

        return ApiResponse::success(PeriodeGajiModel::format($hasil), 'Periode dikembalikan ke draft');
    }

    // PUT /api/v1/periode-gaji/(:num)/setujui   menunggu_validasi -> disetujui   body: {"catatan"?}
    public function setujui($id = null)
    {
        $in      = $this->body();
        $catatan = isset($in['catatan']) ? mb_substr(trim((string) $in['catatan']), 0, 255) : null;

        $hasil = $this->transisi((int) $id, 'menunggu_validasi', 'disetujui', $catatan);
        if (! is_array($hasil)) {
            return $hasil;
        }

        $this->aman(static function () use ($hasil) {
            NotifikasiModel::kirimKeRole('keuangan', 'Penggajian disetujui', "Periode {$hasil['periode']} disetujui dan siap dibayarkan.", 'penggajian', '/penggajian/' . $hasil['id']);
        });

        return ApiResponse::success(PeriodeGajiModel::format($hasil), 'Periode disetujui');
    }

    // PUT /api/v1/periode-gaji/(:num)/bayar   disetujui -> dibayar   body: {"tanggal_bayar"?}
    // Slip gaji diterbitkan untuk semua karyawan di periode ini.
    public function bayar($id = null)
    {
        $in = $this->body();
        $validation = service('validation');
        $validation->setRules(['tanggal_bayar' => 'permit_empty|valid_date[Y-m-d]']);
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }
        $tgl = ! empty($in['tanggal_bayar']) ? $in['tanggal_bayar'] : date('Y-m-d');

        $hasil = $this->transisi((int) $id, 'disetujui', 'dibayar', null, ['tanggal_bayar' => $tgl], null, static function ($p, $db, $now) use ($tgl) {
            $rows  = $db->table('penggajian')->select('id')->where('periode_gaji_id', $p['id'])->get()->getResultArray();
            $batch = [];
            foreach ($rows as $r) {
                $batch[] = [
                    'penggajian_id'  => (int) $r['id'],
                    'nomor_slip'     => sprintf('SLP-%s-%05d', str_replace('-', '', $p['periode']), $r['id']),
                    'tanggal_terbit' => $tgl,
                    'created_at'     => $now,
                ];
            }
            if ($batch) {
                $db->table('slip_gaji')->insertBatch($batch);
            }
        });
        if (! is_array($hasil)) {
            return $hasil;
        }

        $this->aman(static function () use ($hasil) {
            $users = db_connect()->table('penggajian g')
                ->select('u.id AS user_id')
                ->join('users u', 'u.karyawan_id = g.karyawan_id')
                ->where('g.periode_gaji_id', $hasil['id'])
                ->where('u.aktif', 1)
                ->get()->getResultArray();

            $now   = date('Y-m-d H:i:s');
            $batch = [];
            foreach ($users as $u) {
                $batch[] = [
                    'user_id'    => (int) $u['user_id'],
                    'judul'      => 'Slip gaji ' . $hasil['periode'] . ' terbit',
                    'pesan'      => 'Gaji periode ' . $hasil['periode'] . ' sudah dibayarkan. Slip gaji bisa dilihat.',
                    'tipe'       => 'slip',
                    'tautan'     => '/slip-gaji',
                    'created_at' => $now,
                ];
            }
            if ($batch) {
                (new NotifikasiModel())->insertBatch($batch);
            }
        });

        return ApiResponse::success(PeriodeGajiModel::format($hasil), 'Gaji dibayarkan dan slip diterbitkan');
    }

    // ---------- helper ----------

    /**
     * Ubah status periode dalam satu transaksi (baris dikunci).
     * Mengembalikan array baris periode terbaru, atau response error.
     */
    private function transisi(int $id, string $dari, string $ke, ?string $catatan, array $ubah = [], ?callable $pra = null, ?callable $pasca = null)
    {
        $db = db_connect();
        $db->transBegin();

        try {
            $p = $db->query('SELECT * FROM periode_gaji WHERE id = ? FOR UPDATE', [$id])->getRowArray();

            if (! $p) {
                $db->transRollback();
                return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
            }
            if ($p['status'] !== $dari) {
                $db->transRollback();
                return ApiResponse::error('UNPROCESSABLE', "Periode berstatus {$p['status']}, harus {$dari} untuk aksi ini", null, 422);
            }
            if ($pra && ($err = $pra($p, $db))) {
                $db->transRollback();
                return ApiResponse::error($err[0], $err[1], null, $err[2]);
            }

            $now = date('Y-m-d H:i:s');
            $db->table('periode_gaji')->where('id', $p['id'])->update(array_merge(['status' => $ke, 'updated_at' => $now], $ubah));
            $db->table('periode_status_log')->insert([
                'periode_gaji_id' => (int) $p['id'],
                'status'          => $ke,
                'oleh'            => $this->userId(),
                'catatan'         => $catatan,
                'created_at'      => $now,
            ]);

            if ($pasca) {
                $pasca($p, $db, $now);
            }

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal ubah status periode: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal mengubah status periode', null, 500);
        }

        return $this->model->find($id);
    }

    private function aman(callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            log_message('error', 'Notifikasi payroll gagal: ' . $e->getMessage());
        }
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
}