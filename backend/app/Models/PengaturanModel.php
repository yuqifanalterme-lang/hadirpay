<?php

namespace App\Models;

use CodeIgniter\Model;

class PengaturanModel extends Model
{
    protected $table          = 'pengaturan';
    protected $primaryKey     = 'key';
    protected $returnType     = 'array';
    protected $useAutoIncrement = false;
    protected $useTimestamps  = false; // updated_at diisi manual
    protected $allowedFields  = ['key', 'value_json', 'updated_at'];

    /** Semua pengaturan sebagai [key => value] */
    public function semua(): array
    {
        $out = [];
        foreach ($this->orderBy('key', 'ASC')->findAll() as $r) {
            $out[$r['key']] = json_decode($r['value_json'], true);
        }
        return $out;
    }

    public function ambil(string $key): ?array
    {
        $r = $this->where('key', $key)->first();
        if (! $r) {
            return null;
        }
        return [
            'key'        => $r['key'],
            'value'      => json_decode($r['value_json'], true),
            'updated_at' => $r['updated_at'],
        ];
    }

    public function simpan(string $key, $value): void
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $now  = date('Y-m-d H:i:s');
        $tbl  = $this->db->table($this->table);

        $ada = $this->db->table($this->table)->where('key', $key)->countAllResults() > 0;
        if ($ada) {
            $tbl->where('key', $key)->update(['value_json' => $json, 'updated_at' => $now]);
        } else {
            $tbl->insert(['key' => $key, 'value_json' => $json, 'updated_at' => $now]);
        }
    }

    public function hapus(string $key): void
    {
        $this->db->table($this->table)->where('key', $key)->delete();
    }
}