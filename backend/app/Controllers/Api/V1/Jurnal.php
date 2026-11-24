<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Libraries\Tanggal;
use App\Services\AccountingService;

class Jurnal extends BaseController
{
    // GET /api/v1/jurnal?tanggal_dari=&tanggal_sampai=&sumber=&periode_gaji_id=&status=aktif&search=&page=1&per_page=10
    public function index()
    {
        $db      = db_connect();
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $dari    = $this->tgl('tanggal_dari');
        $sampai  = $this->tgl('tanggal_sampai');
        $sumber  = (string) $this->request->getGet('sumber');
        $pid     = (int) $this->request->getGet('periode_gaji_id');
        $q       = trim((string) $this->request->getGet('search'));
        $stParam = trim((string) ($this->request->getGet('status') ?? ''));
        $status  = in_array($stParam, ['aktif', 'dibatalkan', 'semua'], true) ? $stParam : 'aktif';

        $dasar = function () use ($db, $dari, $sampai, $sumber, $pid, $q, $status) {
            $b = $db->table('jurnal j')
                ->join('periode_gaji p', 'p.id = j.periode_gaji_id', 'left')
                ->join('users uc', 'uc.id = j.cancelled_by', 'left')
                ->join('users ub', 'ub.id = j.dibatalkan_oleh', 'left');
            if ($status !== 'semua') {
                $b->where('j.status', $status);
            }
            if ($dari) {
                $b->where('j.tanggal >=', $dari);
            }
            if ($sampai) {
                $b->where('j.tanggal <=', $sampai);
            }
            if (in_array($sumber, ['otomatis', 'manual'], true)) {
                $b->where('j.sumber', $sumber);
            }
            if ($pid > 0) {
                $b->where('j.periode_gaji_id', $pid);
            }
            if ($q !== '') {
                $b->groupStart()->like('j.nomor_bukti', $q)->orLike('j.keterangan', $q)->groupEnd();
            }
            return $b;
        };

        $total = $dasar()->countAllResults();
        $rows  = $dasar()
            ->select('j.*, p.periode AS periode_kode, COALESCE(uc.nama, ub.nama) AS dibatalkan_oleh_nama', false)
            ->orderBy('j.tanggal', 'DESC')->orderBy('j.id', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        return ApiResponse::success($this->rapikan($rows), 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    // GET /api/v1/jurnal/(:num)
    public function show($id = null)
    {
        $data = $this->satu((int) $id);
        if (! $data) {
            return ApiResponse::error('NOT_FOUND', 'Jurnal tidak ditemukan', null, 404);
        }
        return ApiResponse::success($data);
    }

    // POST /api/v1/jurnal   (jurnal manual)
    public function create()
    {
        $in = $this->body();
        [$errors, $lines, $tanggal, $ket] = $this->validasi($in);
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }
        if ($salah = $this->cekSeimbang($lines)) {
            return $salah;
        }

        $db = db_connect();
        $db->transBegin();
        try {
            $id = AccountingService::simpanJurnal($db, [
                'tanggal'         => $tanggal,
                'keterangan'      => $ket,
                'sumber'          => 'manual',
                'jenis'           => 'manual',
                'periode_gaji_id' => null,
                'dibuat_oleh'     => $this->userId(),
            ], $lines);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal simpan jurnal: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal menyimpan jurnal', null, 500);
        }

        return ApiResponse::success($this->satu($id), 'Jurnal dibuat', null, 201);
    }

    // PUT /api/v1/jurnal/(:num)   (hanya jurnal manual)
    public function update($id = null)
    {
        $db  = db_connect();
        $row = $db->table('jurnal')->where('id', (int) $id)->get()->getRowArray();
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Jurnal tidak ditemukan', null, 404);
        }
        if ($row['sumber'] !== 'manual') {
            return ApiResponse::error('FORBIDDEN', 'Jurnal otomatis tidak boleh diubah atau dihapus', null, 403);
        }
        if (($row['status'] ?? 'aktif') === 'dibatalkan') {
            return ApiResponse::error('INVALID_STATUS_TRANSITION', 'Jurnal yang sudah dibatalkan tidak boleh diubah', null, 409);
        }

        $in = $this->body();
        [$errors, $lines, $tanggal, $ket] = $this->validasi($in);
        if ($errors) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $errors, 422);
        }
        if ($salah = $this->cekSeimbang($lines)) {
            return $salah;
        }

        [$d, $k] = $this->totalSen($lines);

        $db->transBegin();
        try {
            $db->table('jurnal')->where('id', (int) $row['id'])->update([
                'tanggal'      => $tanggal,
                'keterangan'   => mb_substr($ket, 0, 255),
                'total_debit'  => $d / 100,
                'total_kredit' => $k / 100,
                'updated_at'   => date('Y-m-d H:i:s'),
            ]);
            $db->table('detail_jurnal')->where('jurnal_id', (int) $row['id'])->delete();
            AccountingService::isiDetail($db, (int) $row['id'], $lines);
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Gagal ubah jurnal: ' . $e->getMessage());
            return ApiResponse::error('SERVER_ERROR', 'Gagal memperbarui jurnal', null, 500);
        }

        return ApiResponse::success($this->satu((int) $row['id']), 'Jurnal diperbarui');
    }

    // DELETE /api/v1/jurnal/(:num)   (hanya jurnal manual, soft delete -> status = dibatalkan)
    public function delete($id = null)
    {
        $db  = db_connect();
        $row = $db->table('jurnal')->where('id', (int) $id)->get()->getRowArray();
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Jurnal tidak ditemukan', null, 404);
        }
        $failure = AccountingService::errorHapusJurnalLangsung($row);
        if ($failure) {
            return ApiResponse::error($failure['code'], $failure['message'], null, $failure['status']);
        }

        $in     = $this->body();
        $alasan = trim((string) ($in['alasan'] ?? ''));
        if ($alasan === '' || mb_strlen($alasan) > 255) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', [
                'alasan' => 'Alasan pembatalan wajib diisi (maksimal 255 karakter)',
            ], 422);
        }

        AccountingService::batalkanJurnal($db, (int) $id, $this->userId(), $alasan);

        return ApiResponse::success($this->satu((int) $id), 'Jurnal dibatalkan');
    }

    // ---------- helper ----------

    private function satu(int $id): ?array
    {
        $row = db_connect()->table('jurnal j')
            ->select('j.*, p.periode AS periode_kode, COALESCE(uc.nama, ub.nama) AS dibatalkan_oleh_nama', false)
            ->join('periode_gaji p', 'p.id = j.periode_gaji_id', 'left')
            ->join('users uc', 'uc.id = j.cancelled_by', 'left')
            ->join('users ub', 'ub.id = j.dibatalkan_oleh', 'left')
            ->where('j.id', $id)
            ->get()->getRowArray();

        return $row ? $this->rapikan([$row])[0] : null;
    }

    /** @param list<array<string, mixed>> $rows */
    private function rapikan(array $rows): array
    {
        if (! $rows) {
            return [];
        }

        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
        $det = db_connect()->table('detail_jurnal dj')
            ->select('dj.jurnal_id, dj.akun_id, a.kode AS kode_akun, a.nama AS nama_akun, dj.debit, dj.kredit')
            ->join('akun a', 'a.id = dj.akun_id')
            ->whereIn('dj.jurnal_id', $ids)
            ->orderBy('dj.jurnal_id', 'ASC')->orderBy('dj.urutan', 'ASC')->orderBy('dj.id', 'ASC')
            ->get()->getResultArray();

        $per = [];
        foreach ($det as $d) {
            $per[(int) $d['jurnal_id']][] = [
                'akun_id'   => (int) $d['akun_id'],
                'kode_akun' => $d['kode_akun'],
                'nama_akun' => $d['nama_akun'],
                'debit'     => (float) $d['debit'],
                'kredit'    => (float) $d['kredit'],
            ];
        }

        return array_map(static fn ($r) => [
            'id'                => (int) $r['id'],
            'nomor_bukti'       => $r['nomor_bukti'],
            'tanggal'           => $r['tanggal'],
            'keterangan'        => $r['keterangan'],
            'sumber'            => $r['sumber'],
            'jenis'             => $r['jenis'],
            'status'            => $r['status'] ?? 'aktif',
            'reversal_of'       => isset($r['reversal_of']) ? (int) $r['reversal_of'] : null,
            'periode_gaji'      => $r['periode_gaji_id'] !== null ? ['id' => (int) $r['periode_gaji_id'], 'periode' => $r['periode_kode']] : null,
            'total_debit'       => (float) $r['total_debit'],
            'total_kredit'      => (float) $r['total_kredit'],
            'cancelled_by'      => ($r['cancelled_by'] ?? $r['dibatalkan_oleh'] ?? null) !== null
                ? ['id' => (int) ($r['cancelled_by'] ?? $r['dibatalkan_oleh']), 'nama' => $r['dibatalkan_oleh_nama']]
                : null,
            'cancelled_at'      => Tanggal::waktuIso($r['cancelled_at'] ?? $r['dibatalkan_pada'] ?? null),
            'cancel_reason'     => $r['cancel_reason'] ?? $r['alasan_pembatalan'] ?? null,
            'dibatalkan_oleh'   => ($r['cancelled_by'] ?? $r['dibatalkan_oleh'] ?? null) !== null
                ? ['id' => (int) ($r['cancelled_by'] ?? $r['dibatalkan_oleh']), 'nama' => $r['dibatalkan_oleh_nama']]
                : null,
            'dibatalkan_pada'   => Tanggal::waktuIso($r['cancelled_at'] ?? $r['dibatalkan_pada'] ?? null),
            'alasan_pembatalan' => $r['cancel_reason'] ?? $r['alasan_pembatalan'] ?? null,
            'detail'            => $per[(int) $r['id']] ?? [],
        ], $rows);
    }

    /** @return array{0: array<string,string>, 1: list<array>, 2: string, 3: string} */
    private function validasi(array $in): array
    {
        $errors  = [];
        $tanggal = trim((string) ($in['tanggal'] ?? ''));
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)
            || ! checkdate((int) substr($tanggal, 5, 2), (int) substr($tanggal, 8, 2), (int) substr($tanggal, 0, 4))) {
            $errors['tanggal'] = 'Tanggal wajib berformat YYYY-MM-DD';
        }

        $ket = trim((string) ($in['keterangan'] ?? ''));
        if (mb_strlen($ket) < 3 || mb_strlen($ket) > 255) {
            $errors['keterangan'] = 'Keterangan wajib diisi (3 sampai 255 karakter)';
        }

        $lines  = [];
        $detail = $in['detail'] ?? null;
        if (! is_array($detail) || count($detail) < 2 || count($detail) > 50) {
            $errors['detail'] = 'Jurnal minimal 2 baris dan maksimal 50 baris';
        } else {
            $ids = [];
            foreach ($detail as $d) {
                if (is_array($d) && isset($d['akun_id'])) {
                    $ids[] = (int) $d['akun_id'];
                }
            }
            $valid = $ids
                ? array_map('intval', array_column(db_connect()->table('akun')->select('id')->whereIn('id', $ids)->where('aktif', 1)->get()->getResultArray(), 'id'))
                : [];

            foreach ($detail as $i => $d) {
                $no = $i + 1;
                if (! is_array($d)) {
                    $errors["detail.$i"] = "Baris $no tidak valid";
                    continue;
                }
                $akun = (int) ($d['akun_id'] ?? 0);
                $deb  = $d['debit'] ?? 0;
                $kre  = $d['kredit'] ?? 0;

                if (! in_array($akun, $valid, true)) {
                    $errors["detail.$i.akun_id"] = "Baris $no: akun tidak ditemukan atau tidak aktif";
                    continue;
                }
                if (! is_numeric($deb) || ! is_numeric($kre) || $deb < 0 || $kre < 0) {
                    $errors["detail.$i"] = "Baris $no: debit dan kredit harus angka 0 atau lebih";
                    continue;
                }
                if (($deb > 0) === ($kre > 0)) {
                    $errors["detail.$i"] = "Baris $no: isi salah satu saja, debit atau kredit";
                    continue;
                }
                $lines[] = ['akun_id' => $akun, 'debit' => (float) $deb, 'kredit' => (float) $kre];
            }
        }

        return [$errors, $lines, $tanggal, $ket];
    }

    /** @return array{0:int, 1:int} */
    private function totalSen(array $lines): array
    {
        $d = 0;
        $k = 0;
        foreach ($lines as $l) {
            $d += AccountingService::sen($l['debit']);
            $k += AccountingService::sen($l['kredit']);
        }
        return [$d, $k];
    }

    private function cekSeimbang(array $lines)
    {
        [$d, $k] = $this->totalSen($lines);
        if ($d !== $k) {
            return ApiResponse::error(
                'JOURNAL_NOT_BALANCED',
                'Total debit (' . number_format($d / 100, 2, ',', '.') . ') dan kredit (' . number_format($k / 100, 2, ',', '.') . ') harus sama',
                null,
                422
            );
        }
        return null;
    }

    private function tgl(string $key): ?string
    {
        $v = (string) $this->request->getGet($key);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    }

    private function body(): array
    {
        try {
            $json = $this->request->getJSON(true);
            if (is_array($json)) {
                return $json;
            }
        } catch (\Throwable $e) {
        }
        $raw = (string) $this->request->getBody();
        if ($raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
        return $this->request->getRawInput() ?: [];
    }

    private function userId(): ?int
    {
        $id = (int) ((JwtService::$user ?? [])['id'] ?? 0);
        return $id > 0 ? $id : null;
    }
}