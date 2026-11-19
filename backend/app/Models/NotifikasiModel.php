<?php

namespace App\Models;

use CodeIgniter\Model;

class NotifikasiModel extends Model
{
    protected $table         = 'notifikasi';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false; // tabel hanya punya created_at, diisi manual
    protected $allowedFields = ['user_id', 'judul', 'pesan', 'tipe', 'tautan', 'dibaca_pada', 'created_at'];

    public const TIPE = ['pengajuan', 'penggajian', 'slip', 'sistem'];
    public const ROLE = ['admin_hrd', 'karyawan', 'keuangan', 'pemilik'];

    /**
     * Helper untuk modul lain:
     *   NotifikasiModel::kirim($userId, 'Cuti disetujui', 'Pengajuan cuti kamu disetujui', 'pengajuan', '/cuti');
     */
    public static function kirim(int $userId, string $judul, string $pesan, string $tipe = 'sistem', ?string $tautan = null): void
    {
        (new self())->insert([
            'user_id'    => $userId,
            'judul'      => mb_substr($judul, 0, 150),
            'pesan'      => mb_substr($pesan, 0, 255),
            'tipe'       => in_array($tipe, self::TIPE, true) ? $tipe : 'sistem',
            'tautan'     => $tautan === null ? null : mb_substr($tautan, 0, 255),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /** Kirim ke semua user aktif dengan role tertentu. Mengembalikan jumlah penerima. */
    public static function kirimKeRole(string $role, string $judul, string $pesan, string $tipe = 'sistem', ?string $tautan = null): int
    {
        $db  = db_connect();
        $ids = $db->table('users')->select('id')->where('role', $role)->where('aktif', 1)->get()->getResultArray();
        if (! $ids) {
            return 0;
        }

        $now   = date('Y-m-d H:i:s');
        $batch = [];
        foreach ($ids as $u) {
            $batch[] = [
                'user_id'    => (int) $u['id'],
                'judul'      => mb_substr($judul, 0, 150),
                'pesan'      => mb_substr($pesan, 0, 255),
                'tipe'       => in_array($tipe, self::TIPE, true) ? $tipe : 'sistem',
                'tautan'     => $tautan === null ? null : mb_substr($tautan, 0, 255),
                'created_at' => $now,
            ];
        }
        $db->table('notifikasi')->insertBatch($batch);

        return count($batch);
    }

    public static function format(array $r): array
    {
        $r['dibaca'] = $r['dibaca_pada'] !== null;
        return $r;
    }
}