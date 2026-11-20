<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Libraries\ApiResponse;
use App\Libraries\JwtService;
use App\Libraries\Tanggal;
use App\Models\NotifikasiModel;

class Notifikasi extends BaseController
{
    private NotifikasiModel $model;

    public function __construct()
    {
        $this->model = new NotifikasiModel();
    }

    // GET /api/v1/notifikasi?belum_dibaca=true&tipe=pengajuan&page=1&per_page=10
    public function index()
    {
        $uid     = $this->userId();
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(100, max(1, (int) ($this->request->getGet('per_page') ?? 10)));
        $tipe    = (string) $this->request->getGet('tipe');
        $belum   = in_array(strtolower((string) $this->request->getGet('belum_dibaca')), ['1', 'true'], true);

        $this->model->where('user_id', $uid);
        if (in_array($tipe, NotifikasiModel::TIPE, true)) {
            $this->model->where('tipe', $tipe);
        }
        if ($belum) {
            $this->model->where('dibaca_pada IS NULL', null, false);
        }

        $total = $this->model->countAllResults(false);
        $rows  = $this->model->orderBy('created_at', 'DESC')->orderBy('id', 'DESC')->findAll($perPage, ($page - 1) * $perPage);

        $data = array_map(static fn ($r) => [
            'id'          => (int) $r['id'],
            'judul'       => $r['judul'],
            'pesan'       => $r['pesan'],
            'tipe'        => $r['tipe'],
            'tautan'      => $r['tautan'],
            'dibaca'      => $r['dibaca_pada'] !== null,
            'dibuat_pada' => Tanggal::waktuIso($r['created_at']),
        ], $rows);

        return ApiResponse::success($data, 'OK', [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ], 200, ['jumlah_belum_dibaca' => $this->hitungBelumDibaca($uid)]);
    }

    // PATCH /api/v1/notifikasi/(:num)/baca
    public function baca($id = null)
    {
        $row = $this->model->where('id', (int) $id)->where('user_id', $this->userId())->first();
        if (! $row) {
            return ApiResponse::error('NOT_FOUND', 'Notifikasi tidak ditemukan', null, 404);
        }

        if ($row['dibaca_pada'] === null) {
            $this->model->update($row['id'], ['dibaca_pada' => date('Y-m-d H:i:s')]);
        }
        return ApiResponse::success(null, 'Notifikasi ditandai sudah dibaca');
    }

    // POST /api/v1/notifikasi/baca-semua
    public function bacaSemua()
    {
        db_connect()->table('notifikasi')
            ->where('user_id', $this->userId())
            ->where('dibaca_pada IS NULL', null, false)
            ->update(['dibaca_pada' => date('Y-m-d H:i:s')]);

        return ApiResponse::success(null, 'Semua notifikasi ditandai sudah dibaca');
    }

    // POST /api/v1/notifikasi   (admin_hrd) body: {judul, pesan, tipe?, tautan?, user_id | role}
    public function create()
    {
        $in = $this->request->getJSON(true) ?? [];

        $validation = service('validation');
        $validation->setRules([
            'judul'   => 'required|max_length[150]',
            'pesan'   => 'required|max_length[255]',
            'tipe'    => 'permit_empty|in_list[' . implode(',', NotifikasiModel::TIPE) . ']',
            'tautan'  => 'permit_empty|max_length[255]',
            'user_id' => 'permit_empty|is_natural_no_zero|is_not_unique[users.id]',
            'role'    => 'permit_empty|in_list[' . implode(',', NotifikasiModel::ROLE) . ']',
        ], [
            'judul'   => ['required' => 'Judul wajib diisi'],
            'pesan'   => ['required' => 'Pesan wajib diisi'],
            'user_id' => ['is_not_unique' => 'User tidak ditemukan'],
        ]);
        if (! $validation->run($in)) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', $validation->getErrors(), 422);
        }

        $adaUser = ! empty($in['user_id']);
        $adaRole = ! empty($in['role']);
        if ($adaUser === $adaRole) {
            return ApiResponse::error('VALIDATION_ERROR', 'Data tidak valid', ['user_id' => 'Isi salah satu saja: user_id atau role penerima'], 422);
        }

        $tipe   = $in['tipe'] ?? 'sistem';
        $tautan = $in['tautan'] ?? null;

        if ($adaUser) {
            NotifikasiModel::kirim((int) $in['user_id'], $in['judul'], $in['pesan'], $tipe, $tautan);
            $jumlah = 1;
        } else {
            $jumlah = NotifikasiModel::kirimKeRole($in['role'], $in['judul'], $in['pesan'], $tipe, $tautan);
        }

        return ApiResponse::success(['jumlah_terkirim' => $jumlah], 'Notifikasi dikirim', null, 201);
    }

    private function userId(): int
    {
        return (int) ((JwtService::$user ?? [])['id'] ?? 0);
    }

    private function hitungBelumDibaca(int $uid): int
    {
        return $this->model
            ->where('user_id', $uid)
            ->where('dibaca_pada IS NULL', null, false)
            ->countAllResults();
    }
}