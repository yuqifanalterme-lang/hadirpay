<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Libraries\Tanggal;
use App\Models\PengaturanModel;
use App\Services\PayslipFormatter;

class SlipGaji extends BaseController
{
    private const ROLE_LIHAT_SEMUA = ['admin_hrd', 'keuangan', 'pemilik'];

    // GET /api/v1/slip-gaji?karyawan_id=&periode=2026-11&search=&page=1&per_page=10
    // Karyawan biasa hanya melihat miliknya sendiri.
    public function index()
    {
        $role = $this->role();
        if (in_array($role, self::ROLE_LIHAT_SEMUA, true)) {
            return $this->daftar(null);
        }

        $kid = $this->karyawanId();
        if (! $kid) {
            return ApiResponse::error('NO_KARYAWAN', 'Akun ini tidak terhubung ke data karyawan', null, 404);
        }
        return $this->daftar($kid);
    }

    // GET /api/v1/slip-gaji/saya   (alias: slip milik sendiri untuk semua role)
    public function saya()
    {
        $kid = $this->karyawanId();
        if (! $kid) {
            return ApiResponse::error('NO_KARYAWAN', 'Akun ini tidak terhubung ke data karyawan', null, 404);
        }
        return $this->daftar($kid);
    }

    // GET /api/v1/slip-gaji/(:num)
    public function show($id = null)
    {
        $db = db_connect();

        $s = $db->table('slip_gaji s')
            ->select('s.id, s.penggajian_id, s.nomor_slip, s.tanggal_terbit, g.karyawan_id, p.periode')
            ->join('penggajian g', 'g.id = s.penggajian_id')
            ->join('periode_gaji p', 'p.id = g.periode_gaji_id')
            ->where('s.id', (int) $id)
            ->get()->getRowArray();

        if (! $s) {
            return ApiResponse::error('NOT_FOUND', 'Slip gaji tidak ditemukan', null, 404);
        }

        if (! in_array($this->role(), self::ROLE_LIHAT_SEMUA, true) && (int) $s['karyawan_id'] !== (int) $this->karyawanId()) {
            return ApiResponse::error('FORBIDDEN', 'Anda tidak berhak mengakses data ini', null, 403);
        }

        $detail = PayslipFormatter::detail((int) $s['penggajian_id']);
        if (! $detail) {
            return ApiResponse::error('NOT_FOUND', 'Data penggajian slip tidak ditemukan', null, 404);
        }

        $detail['id']             = (int) $s['id'];
        $detail['penggajian_id']  = (int) $s['penggajian_id'];
        $detail['label']          = Tanggal::labelPeriode($s['periode']);
        $detail['nomor_slip']     = $s['nomor_slip'];
        $detail['tanggal_terbit'] = $s['tanggal_terbit'];

        $p = (new PengaturanModel())->ambil('perusahaan');
        $v = is_array($p['value'] ?? null) ? $p['value'] : [];
        $detail['perusahaan'] = [
            'nama'     => $v['nama'] ?? 'HADIRPAY',
            'alamat'   => $v['alamat'] ?? null,
            'logo_url' => $v['logo_url'] ?? null,
        ];

        return ApiResponse::success($detail);
    }

    // ---------- helper ----------

    private function daftar(?int $paksaKaryawan)
    {
        $db      = db_connect();
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $q       = trim((string) $this->request->getGet('search'));
        $periode = (string) $this->request->getGet('periode');
        $kidGet  = (int) $this->request->getGet('karyawan_id');

        $dasar = static function () use ($db, $paksaKaryawan, $kidGet, $periode, $q) {
            $b = $db->table('slip_gaji s')
                ->join('penggajian g', 'g.id = s.penggajian_id')
                ->join('periode_gaji p', 'p.id = g.periode_gaji_id')
                ->join('karyawan k', 'k.id = g.karyawan_id');

            if ($paksaKaryawan !== null) {
                $b->where('g.karyawan_id', $paksaKaryawan);
            } elseif ($kidGet > 0) {
                $b->where('g.karyawan_id', $kidGet);
            }
            if (preg_match('/^\d{4}-\d{2}$/', $periode)) {
                $b->where('p.periode', $periode);
            }
            if ($q !== '') {
                $b->groupStart()->like('k.nama', $q)->orLike('k.kode', $q)->orLike('s.nomor_slip', $q)->groupEnd();
            }
            return $b;
        };

        $total = $dasar()->countAllResults();
        $rows  = $dasar()
            ->select('s.id, s.penggajian_id, s.nomor_slip, s.tanggal_terbit, p.periode, g.gaji_bersih, k.id AS karyawan_id, k.nama AS karyawan_nama')
            ->orderBy('p.periode', 'DESC')->orderBy('k.nama', 'ASC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()->getResultArray();

        $data = array_map(static fn ($r) => [
            'id'             => (int) $r['id'],
            'penggajian_id'  => (int) $r['penggajian_id'],
            'nomor_slip'     => $r['nomor_slip'],
            'periode'        => $r['periode'],
            'label'          => Tanggal::labelPeriode($r['periode']),
            'tanggal_terbit' => $r['tanggal_terbit'],
            'karyawan'       => ['id' => (int) $r['karyawan_id'], 'nama' => $r['karyawan_nama']],
            'gaji_bersih'    => (float) $r['gaji_bersih'],
        ], $rows);

        return ApiResponse::success($data, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ]);
    }

    private function role(): string
    {
        return (string) ((JwtService::$user ?? [])['role'] ?? '');
    }

    private function karyawanId(): ?int
    {
        $id = (JwtService::$user ?? [])['karyawan_id'] ?? null;
        return $id !== null ? (int) $id : null;
    }
}