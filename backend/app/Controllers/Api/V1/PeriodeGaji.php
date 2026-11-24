<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Libraries\Tanggal;
use App\Models\NotifikasiModel;
use App\Models\PeriodeGajiModel;
use App\Services\AccountingService;
use App\Services\PayrollCancellationPolicy;
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
        $db = db_connect();
        $page = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $status = (string) $this->request->getGet('status');
        $tahun = (int) ($this->request->getGet('tahun') ?? 0);

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

        $uids = array_values(array_unique(array_filter(array_map(static fn($r) => (int) $r['dibuat_oleh'], $rows))));
        $nama = $uids ? array_column($db->table('users')->select('id, nama')->whereIn('id', $uids)->get()->getResultArray(), 'nama', 'id') : [];

        $data = array_map(static fn($r) => [
            'id' => (int) $r['id'],
            'periode' => $r['periode'],
            'label' => Tanggal::labelPeriode($r['periode']),
            'tanggal_mulai' => $r['tanggal_mulai'],
            'tanggal_selesai' => $r['tanggal_selesai'],
            'tanggal_tutup' => $r['tanggal_tutup'],
            'hari_kerja' => (int) $r['hari_kerja'],
            'status' => $r['status'],
            'ditutup' => (bool) ($r['ditutup'] ?? false),
            'jumlah_karyawan' => (int) $r['jumlah_karyawan'],
            'total_pendapatan' => (float) $r['total_pendapatan'],
            'total_potongan' => (float) $r['total_potongan'],
            'total_gaji_bersih' => (float) $r['total_gaji_bersih'],
            'dibuat_oleh' => $nama[$r['dibuat_oleh']] ?? null,
        ], $rows);

        return ApiResponse::success($data, 'OK', [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // GET /api/v1/periode-gaji/(:num)
    public function show($id = null)
    {
        $d = $this->detail((int) $id);
        if (!$d) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }
        return ApiResponse::success($d);
    }

    // POST /api/v1/periode-gaji   body: {"periode":"2026-11", "tanggal_tutup"?, "tanggal_mulai"?, "tanggal_selesai"?}
    public function create()
    {
        $in = $this->body();

        $periode = trim((string) ($in['periode'] ?? ''));
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periode)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['periode' => 'Periode wajib berformat YYYY-MM'], 422);
        }

        $validation = service('validation');
        $validation->setRules([
            'tanggal_mulai' => 'permit_empty|valid_date[Y-m-d]',
            'tanggal_selesai' => 'permit_empty|valid_date[Y-m-d]',
            'tanggal_tutup' => 'permit_empty|valid_date[Y-m-d]',
        ]);
        if (!$validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $mulai = $in['tanggal_mulai'] ?? ($periode . '-01');
        $selesai = $in['tanggal_selesai'] ?? date('Y-m-t', strtotime($periode . '-01'));
        $tutup = $in['tanggal_tutup'] ?? $selesai;

        if ($selesai < $mulai) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['tanggal_selesai' => 'Tanggal selesai tidak boleh sebelum tanggal mulai'], 422);
        }

        if ($this->model->where('periode', $periode)->countAllResults() > 0) {
            return ApiResponse::error('CONFLICT', "Periode {$periode} sudah ada", null, 409);
        }

        $hariKerja = count((new PayrollService())->hariKerja($mulai, $selesai));

        $db = db_connect();
        $db->transBegin();
        try {
            $id = $this->model->insert([
                'periode' => $periode,
                'tanggal_mulai' => $mulai,
                'tanggal_selesai' => $selesai,
                'tanggal_tutup' => $tutup,
                'hari_kerja' => $hariKerja,
                'status' => 'draft',
                'dibuat_oleh' => $this->userId(),
            ], true);

            $db->table('periode_status_log')->insert([
                'periode_gaji_id' => $id,
                'status' => 'draft',
                'oleh' => $this->userId(),
                'catatan' => 'Periode dibuat',
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal membuat periode gaji: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal membuat periode gaji', null, 500);
        }

        return ApiResponse::success($this->detail((int) $id), 'Periode gaji dibuat', null, 201);
    }

    // DELETE /api/v1/periode-gaji/(:num)   (hanya draft)
    public function delete($id = null)
    {
        $db = db_connect();
        $db->transBegin();
        try {
            $p = $db->query('SELECT * FROM periode_gaji WHERE id = ? FOR UPDATE', [(int) $id])->getRowArray();
            if (! $p) {
                $db->transRollback();
                return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
            }
            if ($p['status'] !== 'draft') {
                $db->transRollback();
                return ApiResponse::error('INVALID_STATUS_TRANSITION', 'Hanya periode berstatus draft yang bisa dihapus', null, 409);
            }

            $db->table('periode_gaji')->where('id', (int) $id)->update([
                'jurnal_pengakuan_id' => null,
                'jurnal_pembayaran_id' => null,
            ]);
            if ($db->fieldExists('reversal_of', 'jurnal')) {
                $db->table('jurnal')->where('periode_gaji_id', (int) $id)->update(['reversal_of' => null]);
            }
            $jurnalIds = array_map('intval', array_column(
                $db->table('jurnal')->select('id')->where('periode_gaji_id', (int) $id)->get()->getResultArray(),
                'id'
            ));
            if ($jurnalIds) {
                $db->table('detail_jurnal')->whereIn('jurnal_id', $jurnalIds)->delete();
                $db->table('jurnal')->whereIn('id', $jurnalIds)->delete();
            }
            $penggajianIds = array_map('intval', array_column(
                $db->table('penggajian')->select('id')->where('periode_gaji_id', (int) $id)->get()->getResultArray(),
                'id'
            ));
            if ($penggajianIds) {
                $db->table('slip_gaji')->whereIn('penggajian_id', $penggajianIds)->delete();
                $db->table('detail_penggajian')->whereIn('penggajian_id', $penggajianIds)->delete();
                $db->table('penggajian')->whereIn('id', $penggajianIds)->delete();
            }
            $this->model->delete($id);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal menghapus periode draft: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menghapus periode draft', null, 500);
        }

        return ApiResponse::success(null, 'Periode gaji dihapus');
    }

    // POST /api/v1/periode-gaji/(:num)/hitung
    public function hitung($id = null)
    {
        $p = $this->model->find($id);
        if (!$p) {
            return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
        }
        if ($p['status'] !== 'draft') {
            return ApiResponse::error('INVALID_STATUS_TRANSITION', 'Hanya periode berstatus draft yang bisa dihitung ulang', null, 409);
        }

        try {
            $hasil = (new PayrollService())->hitungPeriode($p);
        } catch (\Throwable $e) {
            log_message('error', 'Gagal hitung gaji: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menghitung gaji', null, 500);
        }

        return ApiResponse::success(['periode_id' => (int) $id] + $hasil, 'Gaji berhasil dihitung');
    }

    // POST /api/v1/periode-gaji/(:num)/ajukan-validasi   draft -> menunggu_validasi
    public function ajukanValidasi($id = null)
    {
        $hasil = $this->transisi((int) $id, 'draft', 'menunggu_validasi', null, [], static function ($p, $db) {
            if (!$p['dihitung_pada']) {
                return ['UNPROCESSABLE', 'Periode belum dihitung', 422];
            }
            if ($db->table('penggajian')->where('periode_gaji_id', $p['id'])->countAllResults() === 0) {
                return ['UNPROCESSABLE', 'Belum ada data penggajian di periode ini', 422];
            }
            return null;
        });
        if (!is_array($hasil)) {
            return $hasil;
        }

        $this->aman(function () use ($hasil) {
            NotifikasiModel::kirimKeRole('keuangan', 'Penggajian menunggu validasi', "Periode {$hasil['periode']} menunggu validasi Anda.", 'penggajian', '/penggajian/' . $hasil['id']);
        });

        return ApiResponse::success($this->detail((int) $id), 'Periode diajukan untuk validasi');
    }

    // POST /api/v1/periode-gaji/(:num)/kembalikan   menunggu_validasi -> draft   body: {"catatan":"..."}
    public function kembalikan($id = null)
    {
        $in = $this->body();
        $validation = service('validation');
        $validation->setRules(['catatan' => 'required|max_length[255]'], ['catatan' => ['required' => 'Catatan pengembalian wajib diisi']]);
        if (!$validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $hasil = $this->transisi((int) $id, 'menunggu_validasi', 'draft', $in['catatan']);
        if (!is_array($hasil)) {
            return $hasil;
        }

        $this->aman(function () use ($hasil, $in) {
            NotifikasiModel::kirimKeRole('admin_hrd', 'Penggajian dikembalikan', "Periode {$hasil['periode']} dikembalikan: {$in['catatan']}", 'penggajian', '/penggajian/' . $hasil['id']);
        });

        return ApiResponse::success($this->detail((int) $id), 'Periode dikembalikan ke draft');
    }

    // POST /api/v1/periode-gaji/(:num)/setujui   menunggu_validasi -> disetujui
    // Membuat slip gaji semua karyawan dan jurnal pengakuan gaji.
    public function setujui($id = null)
    {
        $in = $this->body();
        $catatan = isset($in['catatan']) ? mb_substr(trim((string) $in['catatan']), 0, 255) : null;
        $userId = $this->userId();
        $terbit = date('Y-m-d');

        $hasil = $this->transisi((int) $id, 'menunggu_validasi', 'disetujui', $catatan, [], null, static function ($p, $db, $now) use ($userId, $terbit) {
            $rows = $db->table('penggajian')->select('id')->where('periode_gaji_id', $p['id'])->orderBy('id', 'ASC')->get()->getResultArray();
            $bagi = explode('-', $p['periode']);
            $batch = [];
            foreach ($rows as $i => $r) {
                $batch[] = [
                    'penggajian_id' => (int) $r['id'],
                    'nomor_slip' => sprintf('SLP/%s/%s/%04d', $bagi[0], $bagi[1], $i + 1),
                    'tanggal_terbit' => $terbit,
                    'created_at' => $now,
                ];
            }
            if ($batch) {
                $db->table('slip_gaji')->insertBatch($batch);
            }

            $jurnalId = AccountingService::jurnalPengakuan($db, $p, $userId);
            $db->table('periode_gaji')->where('id', $p['id'])->update(['jurnal_pengakuan_id' => $jurnalId]);
        });
        if (!is_array($hasil)) {
            return $hasil;
        }

        $this->aman(function () use ($hasil) {
            $this->notifKaryawan((int) $hasil['id'], 'Slip gaji ' . $hasil['periode'] . ' terbit', 'Slip gaji periode ' . $hasil['periode'] . ' sudah bisa dilihat.', 'slip', '/slip-gaji');
            NotifikasiModel::kirimKeRole('admin_hrd', 'Penggajian disetujui', "Periode {$hasil['periode']} disetujui dan siap dibayarkan.", 'penggajian', '/penggajian/' . $hasil['id']);
        });

        return ApiResponse::success($this->detail((int) $id), 'Periode disetujui, slip gaji dan jurnal pengakuan dibuat');
    }

    // POST /api/v1/periode-gaji/(:num)/bayar   disetujui -> dibayar
    // body: {"tanggal_bayar"?, "akun_kas_id"?, "catatan"?}. Membuat jurnal pembayaran.
    public function bayar($id = null)
    {
        $in = $this->body();
        $validation = service('validation');
        $validation->setRules([
            'tanggal_bayar' => 'permit_empty|valid_date[Y-m-d]',
            'akun_kas_id' => 'permit_empty|is_natural_no_zero',
        ]);
        if (!$validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $tgl = !empty($in['tanggal_bayar']) ? $in['tanggal_bayar'] : date('Y-m-d');
        $catatan = isset($in['catatan']) ? mb_substr(trim((string) $in['catatan']), 0, 255) : null;

        $db = db_connect();
        $kas = !empty($in['akun_kas_id'])
            ? $db->table('akun')->where('id', (int) $in['akun_kas_id'])->get()->getRowArray()
            : $db->table('akun')->where('kode', AccountingService::AKUN_KAS)->get()->getRowArray();

        if (!$kas || !(int) $kas['aktif'] || $kas['kategori'] !== 'aset') {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['akun_kas_id' => 'Akun kas/bank tidak valid (harus akun aset yang aktif)'], 422);
        }

        $kasId = (int) $kas['id'];
        $userId = $this->userId();

        $hasil = $this->transisi((int) $id, 'disetujui', 'dibayar', $catatan, ['tanggal_bayar' => $tgl], null, static function ($p, $db, $now) use ($userId, $kasId, $tgl) {
            $jurnalId = AccountingService::jurnalPembayaran($db, $p, $userId, $kasId, $tgl);
            $db->table('periode_gaji')->where('id', $p['id'])->update(['jurnal_pembayaran_id' => $jurnalId]);
        });
        if (!is_array($hasil)) {
            return $hasil;
        }

        $this->aman(function () use ($hasil) {
            $this->notifKaryawan((int) $hasil['id'], 'Gaji ' . $hasil['periode'] . ' dibayarkan', 'Gaji periode ' . $hasil['periode'] . ' sudah dibayarkan.', 'penggajian', '/slip-gaji');
        });

        return ApiResponse::success($this->detail((int) $id), 'Gaji dibayarkan dan jurnal pembayaran dibuat');
    }

    // POST /api/v1/periode-gaji/(:num)/batalkan-pembayaran   dibayar -> disetujui   body: {"catatan":"..."}
    // Membatalkan jurnal pembayaran periode tersebut dalam satu transaksi DB.
    public function batalkanPembayaran($id = null)
    {
        $in = $this->body();
        $catatan = trim((string) ($in['catatan'] ?? ''));
        $userId = $this->userId();

        $hasil = $this->transisi(
            (int) $id,
            'dibayar',
            'disetujui',
            $catatan,
            ['tanggal_bayar' => null],
            static function () use ($catatan) {
                if ($catatan === '' || mb_strlen($catatan) > 255) {
                    return ['VALIDATION_ERROR', 'Data tidak valid', 422, ['catatan' => 'Catatan pembatalan pembayaran wajib diisi (maksimal 255 karakter)']];
                }
                return null;
            },
            static function ($p, $db, $now) use ($userId, $catatan) {
                $b = $db->table('jurnal')->where('status', 'aktif');
                $b->groupStart()
                    ->groupStart()
                    ->where('periode_gaji_id', (int) $p['id'])
                    ->where('jenis', 'pembayaran_gaji')
                    ->groupEnd();
                if (!empty($p['jurnal_pembayaran_id'])) {
                    $b->orWhere('id', (int) $p['jurnal_pembayaran_id']);
                }
                $b->groupEnd();
                $b->update([
                    'status' => 'dibatalkan',
                    'dibatalkan_oleh' => $userId > 0 ? $userId : null,
                    'dibatalkan_pada' => $now,
                    'alasan_pembatalan' => $catatan,
                    'updated_at' => $now,
                ]);
            }
        );
        if (!is_array($hasil)) {
            return $hasil;
        }

        return ApiResponse::success($this->detail((int) $id), 'Pembayaran gaji dibatalkan');
    }

    // POST /api/v1/periode-gaji/(:num)/batalkan-persetujuan   disetujui -> menunggu_validasi   body: {"catatan":"..."}
    // Hanya jika belum dibayar. Membatalkan jurnal pengakuan dan menarik slip gaji periode itu dalam satu transaksi DB.
    public function batalkanPersetujuan($id = null)
    {
        $in = $this->body();
        $catatan = trim((string) ($in['catatan'] ?? ''));
        $userId = $this->userId();

        $hasil = $this->transisi(
            (int) $id,
            'disetujui',
            'menunggu_validasi',
            $catatan,
            [],
            static function () use ($catatan) {
                if ($catatan === '' || mb_strlen($catatan) > 255) {
                    return ['VALIDATION_ERROR', 'Data tidak valid', 422, ['catatan' => 'Catatan pembatalan persetujuan wajib diisi (maksimal 255 karakter)']];
                }
                return null;
            },
            static function ($p, $db, $now) use ($userId, $catatan) {
                $b = $db->table('jurnal')->where('status', 'aktif');
                $b->groupStart()
                    ->groupStart()
                    ->where('periode_gaji_id', (int) $p['id'])
                    ->where('jenis', 'pengakuan_gaji')
                    ->groupEnd();
                if (!empty($p['jurnal_pengakuan_id'])) {
                    $b->orWhere('id', (int) $p['jurnal_pengakuan_id']);
                }
                $b->groupEnd();
                $b->update([
                    'status' => 'dibatalkan',
                    'dibatalkan_oleh' => $userId > 0 ? $userId : null,
                    'dibatalkan_pada' => $now,
                    'alasan_pembatalan' => $catatan,
                    'updated_at' => $now,
                ]);

                $gajiIds = array_column(
                    $db->table('penggajian')->select('id')->where('periode_gaji_id', (int) $p['id'])->get()->getResultArray(),
                    'id'
                );
                if ($gajiIds) {
                    $db->table('slip_gaji')->whereIn('penggajian_id', array_map('intval', $gajiIds))->delete();
                }
            }
        );
        if (!is_array($hasil)) {
            return $hasil;
        }

        return ApiResponse::success($this->detail((int) $id), 'Persetujuan gaji dibatalkan, jurnal pengakuan dibatalkan dan slip gaji ditarik');
    }

    // POST /api/v1/periode-gaji/(:num)/batalkan body: {"catatan":"..."} (atau "alasan" / "reason")
    public function batalkan($id = null)
    {
        $in = $this->body();
        $catatan = trim((string) ($in['catatan'] ?? $in['alasan'] ?? $in['reason'] ?? ''));
        $db = db_connect();
        $db->transBegin();

        try {
            $p = $db->query('SELECT * FROM periode_gaji WHERE id = ? FOR UPDATE', [(int) $id])->getRowArray();
            if (! $p) {
                $db->transRollback();
                return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
            }

            $failure = PayrollCancellationPolicy::error(
                (string) (JwtService::$user['role'] ?? ''),
                $p,
                $catatan
            );
            if ($failure) {
                $db->transRollback();
                return ApiResponse::error(
                    $failure['code'],
                    $failure['message'],
                    $failure['errors'] ?? null,
                    $failure['status']
                );
            }

            $journals = $db->query(
                "SELECT * FROM jurnal
                 WHERE periode_gaji_id = ? AND sumber = 'otomatis' AND status = 'aktif'
                 ORDER BY id ASC FOR UPDATE",
                [(int) $id]
            )->getResultArray();
            if (! $journals) {
                $db->transRollback();
                return ApiResponse::error(
                    'JOURNAL_NOT_FOUND',
                    'Tidak ada jurnal otomatis aktif untuk periode penggajian ini',
                    null,
                    409
                );
            }

            $now = date('Y-m-d H:i:s');
            $userId = $this->userId();
            $db->table('periode_gaji')->where('id', (int) $id)->update([
                'status' => 'dibatalkan',
                'updated_at' => $now,
            ]);
            $db->table('periode_status_log')->insert([
                'periode_gaji_id' => (int) $id,
                'status' => 'dibatalkan',
                'oleh' => $userId,
                'catatan' => mb_substr($catatan, 0, 255),
                'created_at' => $now,
            ]);

            foreach ($journals as $journal) {
                AccountingService::batalkanJurnal($db, (int) $journal['id'], $userId, $catatan, $now);
                AccountingService::jurnalPembalik($db, $journal, (int) $userId, $now);
            }

            $payrollIds = array_map('intval', array_column(
                $db->table('penggajian')->select('id')->where('periode_gaji_id', (int) $id)->get()->getResultArray(),
                'id'
            ));
            if ($payrollIds) {
                $db->table('slip_gaji')->whereIn('penggajian_id', $payrollIds)->delete();
            }

            $db->transCommit();
        } catch (\DomainException $e) {
            $db->transRollback();
            return ApiResponse::error('UNPROCESSABLE', $e->getMessage(), null, 422);
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal membatalkan penggajian: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            return ApiResponse::error('SERVER_ERROR', 'Gagal membatalkan penggajian', null, 500);
        }

        return ApiResponse::success($this->detail((int) $id), 'Penggajian dibatalkan dan jurnal pembalik dibuat');
    }

    // ---------- helper ----------

    private function detail(int $id): ?array
    {
        $p = $this->model->find($id);
        if (!$p) {
            return null;
        }

        $db = db_connect();
        $ring = $db->table('penggajian')
            ->select('COUNT(id) AS jumlah_karyawan, COALESCE(SUM(total_pendapatan),0) AS total_pendapatan, '
                . 'COALESCE(SUM(total_potongan),0) AS total_potongan, COALESCE(SUM(gaji_bersih),0) AS total_gaji_bersih')
            ->where('periode_gaji_id', $id)
            ->get()->getRowArray();

        $log = $db->table('periode_status_log l')
            ->select('l.status, l.catatan, l.created_at, u.nama AS oleh_nama')
            ->join('users u', 'u.id = l.oleh', 'left')
            ->where('l.periode_gaji_id', $id)
            ->orderBy('l.id', 'ASC')
            ->get()->getResultArray();

        $pembuat = $db->table('users')->select('nama')->where('id', (int) $p['dibuat_oleh'])->get()->getRowArray();

        $jurnalRows = $db->table('jurnal')
            ->select('id, nomor_bukti, tanggal, keterangan, sumber, jenis, status, reversal_of, total_debit, total_kredit, cancel_reason, cancelled_by, cancelled_at')
            ->where('periode_gaji_id', $id)
            ->orderBy('id', 'ASC')
            ->get()->getResultArray();

        return [
            'id' => (int) $p['id'],
            'periode' => $p['periode'],
            'label' => Tanggal::labelPeriode($p['periode']),
            'tanggal_mulai' => $p['tanggal_mulai'],
            'tanggal_selesai' => $p['tanggal_selesai'],
            'tanggal_tutup' => $p['tanggal_tutup'],
            'hari_kerja' => (int) $p['hari_kerja'],
            'status' => $p['status'],
            'ditutup' => (bool) ($p['ditutup'] ?? false),
            'dihitung_pada' => $p['dihitung_pada'],
            'tanggal_bayar' => $p['tanggal_bayar'],
            'dibuat_oleh' => $pembuat['nama'] ?? null,
            'ringkasan' => [
                'jumlah_karyawan' => (int) $ring['jumlah_karyawan'],
                'total_pendapatan' => (float) $ring['total_pendapatan'],
                'total_potongan' => (float) $ring['total_potongan'],
                'total_gaji_bersih' => (float) $ring['total_gaji_bersih'],
            ],
            'riwayat_status' => array_map(static fn($l) => [
                'status' => $l['status'],
                'oleh' => $l['oleh_nama'],
                'waktu' => Tanggal::waktuIso($l['created_at']),
                'catatan' => $l['catatan'],
            ], $log),
            'jurnal_pengakuan_id' => $p['jurnal_pengakuan_id'] !== null ? (int) $p['jurnal_pengakuan_id'] : null,
            'jurnal_pembayaran_id' => $p['jurnal_pembayaran_id'] !== null ? (int) $p['jurnal_pembayaran_id'] : null,
            'jurnal' => array_map(static fn($j) => [
                'id' => (int) $j['id'],
                'nomor_bukti' => $j['nomor_bukti'],
                'tanggal' => $j['tanggal'],
                'keterangan' => $j['keterangan'],
                'sumber' => $j['sumber'],
                'jenis' => $j['jenis'],
                'status' => $j['status'] ?? 'aktif',
                'reversal_of' => isset($j['reversal_of']) ? (int) $j['reversal_of'] : null,
                'total_debit' => (float) $j['total_debit'],
                'total_kredit' => (float) $j['total_kredit'],
                'cancel_reason' => $j['cancel_reason'] ?? null,
                'cancelled_by' => isset($j['cancelled_by']) ? (int) $j['cancelled_by'] : null,
                'cancelled_at' => Tanggal::waktuIso($j['cancelled_at'] ?? null),
            ], $jurnalRows),
        ];
    }

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

            if (!$p) {
                $db->transRollback();
                return ApiResponse::error('NOT_FOUND', 'Periode gaji tidak ditemukan', null, 404);
            }
            if ($p['status'] !== $dari) {
                $db->transRollback();
                return ApiResponse::error('INVALID_STATUS_TRANSITION', "Periode berstatus {$p['status']}, harus {$dari} untuk aksi ini", null, 409);
            }
            if ($pra && ($err = $pra($p, $db))) {
                $db->transRollback();
                return ApiResponse::error($err[0], $err[1], $err[3] ?? null, $err[2]);
            }

            $now = date('Y-m-d H:i:s');
            $db->table('periode_gaji')->where('id', $p['id'])->update(array_merge(['status' => $ke, 'updated_at' => $now], $ubah));
            $db->table('periode_status_log')->insert([
                'periode_gaji_id' => (int) $p['id'],
                'status' => $ke,
                'oleh' => $this->userId(),
                'catatan' => $catatan,
                'created_at' => $now,
            ]);

            if ($pasca) {
                $pasca($p, $db, $now);
            }

            $db->transCommit();
        } catch (\DomainException $e) {
            $db->transRollback();
            return ApiResponse::error('UNPROCESSABLE', $e->getMessage(), null, 422);
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal ubah status periode: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            return ApiResponse::error('SERVER_ERROR', 'Gagal mengubah status periode', null, 500);
        }

        return $this->model->find($id);
    }

    private function notifKaryawan(int $periodeId, string $judul, string $pesan, string $tipe, string $tautan): void
    {
        $users = db_connect()->table('penggajian g')
            ->select('u.id AS user_id')
            ->join('users u', 'u.karyawan_id = g.karyawan_id')
            ->where('g.periode_gaji_id', $periodeId)
            ->where('u.aktif', 1)
            ->get()->getResultArray();

        $now = date('Y-m-d H:i:s');
        $batch = [];
        foreach ($users as $u) {
            $batch[] = [
                'user_id' => (int) $u['user_id'],
                'judul' => mb_substr($judul, 0, 150),
                'pesan' => mb_substr($pesan, 0, 255),
                'tipe' => $tipe,
                'tautan' => $tautan,
                'created_at' => $now,
            ];
        }
        if ($batch) {
            (new NotifikasiModel())->insertBatch($batch);
        }
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