<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use RuntimeException;
use Throwable;

class Pph21ManualRecoverySeeder extends Seeder
{
    public function run()
    {
        $db = $this->db;
        $db->transBegin();

        try {
            $component = $db->table('komponen_gaji')->where('kode', 'PPH21')->get()->getRowArray();
            if (! $component) {
                throw new RuntimeException('Komponen PPh 21 belum tersedia.');
            }
            if ($component['tipe'] !== 'potongan') {
                throw new RuntimeException('Komponen PPh 21 harus bertipe potongan.');
            }
            if (! in_array($component['metode'], ['persen', 'nominal_tetap'], true)) {
                throw new RuntimeException('Metode komponen PPh 21 tidak didukung: ' . $component['metode']);
            }

            $db->table('komponen_gaji')->where('id', (int) $component['id'])->update([
                'metode'     => 'nominal_tetap',
                'nilai'      => 0,
                'aktif'      => 1,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            if (! $db->transStatus()) {
                throw new RuntimeException('Perbaikan master PPh 21 gagal disimpan.');
            }

            $db->transCommit();
            echo 'Master PPh 21 disetel ke nominal tetap dengan nilai default 0.' . PHP_EOL;
        } catch (Throwable $e) {
            $db->transRollback();
            throw $e;
        }
    }
}
