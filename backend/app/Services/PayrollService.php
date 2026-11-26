<?php // pembulatan-2-desimal

namespace App\Services;

/**
 * Perhitungan gaji satu periode.
 *
 * ATURAN YANG DIPAKAI (ubah di sini kalau kebijakan perusahaan berbeda):
 *  - Hari kerja = jadwal_kerja default dikurangi hari_libur.
 *  - Karyawan "bulanan": gaji pokok penuh (prorata kalau mulai kerja di tengah periode);
 *    potongan alpha = jumlah alpha x (gaji pokok / hari kerja periode), kecuali POT-ALPHA punya nilai sendiri.
 *  - Karyawan "harian": gaji_pokok = upah PER HARI, dibayar untuk hari hadir, terlambat, dan dinas luar.
 *  - Izin dan sakit tidak memotong gaji bulanan.
 *  - Hari tanpa absensi baru dihitung alpha untuk tanggal SEBELUM hari ini.
 *  - Nilai POT-TELAT harus diatur pada komponen karyawan; POT-ALPHA memotong alpha dengan tarif harian dasar bila belum diatur.
 *  - Komponen lain hanya berlaku bila dipasang di karyawan_komponen. Persen dihitung dari gaji pokok.
 *  - Total potongan tidak boleh melebihi pendapatan agar hasil payroll tetap seimbang.
 */
class PayrollService
{
    public const KODE_TELAT  = 'POT-TELAT';
    public const KODE_ALPHA  = 'POT-ALPHA';
    public const KODE_BPJS   = 'BPJS';

    private const FIELD_UANG = ['gaji_pokok', 'tunjangan', 'total_pendapatan', 'total_potongan', 'gaji_bersih', 'tarif_harian'];

    public static function castUang(array $r): array
    {
        foreach (self::FIELD_UANG as $f) {
            if (array_key_exists($f, $r) && $r[$f] !== null) {
                $r[$f] = self::roundMoney($r[$f]);
            }
        }
        return $r;
    }

    public static function roundMoney($value): float
    {
        return round((float) $value, 2);
    }

    /** Daftar tanggal hari kerja (jadwal default, tanpa hari libur). */
    public function hariKerja(string $mulai, string $selesai): array
    {
        $db     = db_connect();
        $jadwal = $db->table('jadwal_kerja')->select('hari_kerja')->where('is_default', 1)->get()->getRowArray();

        $hari = $jadwal
            ? array_filter(array_map('trim', explode(',', strtolower($jadwal['hari_kerja']))))
            : ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];

        $libur = array_column(
            $db->table('hari_libur')->select('tanggal')
                ->where('tanggal >=', $mulai)->where('tanggal <=', $selesai)
                ->get()->getResultArray(),
            'tanggal'
        );

        $nama = [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu', 7 => 'minggu'];
        $out  = [];
        $d    = new \DateTime($mulai);
        $akhir = new \DateTime($selesai);
        while ($d <= $akhir) {
            $t = $d->format('Y-m-d');
            if (in_array($nama[(int) $d->format('N')], $hari, true) && ! in_array($t, $libur, true)) {
                $out[] = $t;
            }
            $d->modify('+1 day');
        }
        return $out;
    }

    /**
     * Hitung ulang seluruh penggajian satu periode (hapus hasil lama, simpan hasil baru).
     * Hanya dipanggil untuk periode berstatus draft.
     */
    public function hitungPeriode(array $periode): array
    {
        $db      = db_connect();
        $mulai   = $periode['tanggal_mulai'];
        $selesai = $periode['tanggal_selesai'];
        $today   = date('Y-m-d');

        $hariKerja = $this->hariKerja($mulai, $selesai);

        $karyawan = $db->table('karyawan')
            ->where('status', 'aktif')
            ->where('tanggal_mulai <=', $selesai)
            ->orderBy('id', 'ASC')
            ->get()->getResultArray();

        $komponen = [];
        $byKode   = [];
        foreach ($db->table('komponen_gaji')->get()->getResultArray() as $k) {
            $komponen[(int) $k['id']] = $k;
            $byKode[$k['kode']]       = $k;
        }

        $assigned = [];
        foreach ($db->table('karyawan_komponen')->get()->getResultArray() as $a) {
            $assigned[(int) $a['karyawan_id']][(int) $a['komponen_id']] = (float) $a['nilai'];
        }

        $absensi = [];
        foreach ($db->table('absensi')->where('tanggal >=', $mulai)->where('tanggal <=', $selesai)->get()->getResultArray() as $a) {
            $absensi[(int) $a['karyawan_id']][$a['tanggal']] = $a;
        }

        $izin = [];
        $rows = $db->table('pengajuan_izin')
            ->whereIn('jenis', ['izin', 'sakit', 'cuti'])
            ->groupStart()
                ->where('status', 'disetujui')
                ->orGroupStart()
                    ->where('status', 'menunggu')
                    ->where('jenis', 'cuti')
                ->groupEnd()
            ->groupEnd()
            ->where('tanggal_mulai <=', $selesai)
            ->where('tanggal_selesai >=', $mulai)
            ->get()->getResultArray();
        foreach ($rows as $z) {
            $izin[(int) $z['karyawan_id']][] = $z;
        }

        $now   = date('Y-m-d H:i:s');
        $total = ['jumlah_karyawan' => 0, 'total_pendapatan' => 0.0, 'total_potongan' => 0.0, 'total_gaji_bersih' => 0.0];

        $db->transBegin();
        try {
            // detail_penggajian ikut terhapus (CASCADE)
            $db->table('penggajian')->where('periode_gaji_id', $periode['id'])->delete();

            foreach ($karyawan as $k) {
                $kid = (int) $k['id'];
                $h   = $this->hitungKaryawan(
                    $k, $hariKerja, $komponen, $byKode,
                    $assigned[$kid] ?? [], $absensi[$kid] ?? [], $izin[$kid] ?? [], $today
                );

                $db->table('penggajian')->insert($h['penggajian'] + [
                    'periode_gaji_id' => (int) $periode['id'],
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ]);
                $pid = (int) $db->insertID();

                $batch = [];
                foreach ($h['detail'] as $i => $d) {
                    $batch[] = [
                        'penggajian_id' => $pid,
                        'komponen_id'   => $d['komponen_id'],
                        'nama'          => mb_substr($d['nama'], 0, 100),
                        'tipe'          => $d['tipe'],
                        'keterangan'    => $d['keterangan'] === null ? null : mb_substr($d['keterangan'], 0, 150),
                        'jumlah'        => $d['jumlah'],
                        'urutan'        => min($i + 1, 255),
                    ];
                }
                if ($batch) {
                    $db->table('detail_penggajian')->insertBatch($batch);
                }

                $total['jumlah_karyawan']++;
                $total['total_pendapatan']  = round($total['total_pendapatan'] + $h['penggajian']['total_pendapatan'], 2);
                $total['total_potongan']    = round($total['total_potongan'] + $h['penggajian']['total_potongan'], 2);
                $total['total_gaji_bersih'] = round($total['total_gaji_bersih'] + $h['penggajian']['gaji_bersih'], 2);
            }

            $db->table('periode_gaji')->where('id', $periode['id'])->update([
                'dihitung_pada' => $now,
                'hari_kerja'    => count($hariKerja),
                'updated_at'    => $now,
            ]);

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            throw $e;
        }

        $total['dihitung_pada'] = $now;
        $total['hari_kerja']    = count($hariKerja);
        return $total;
    }

    // ------------------------------------------------------------------

    public function hitungKaryawan(
        array $k, array $hariKerjaPeriode, array $komponen, array $byKode,
        array $assigned, array $absensi, array $izin, string $today
    ): array {
        $jenis        = $k['jenis_penggajian'];
        $gajiDasar    = (float) $k['gaji_pokok'];
        $totalPeriode = count($hariKerjaPeriode);

        $hariWajib  = array_values(array_filter($hariKerjaPeriode, static fn ($d) => $d >= $k['tanggal_mulai']));
        $totalWajib = count($hariWajib);

        // --- rekap kehadiran per hari kerja ---
        $hitung = ['hadir' => 0, 'terlambat' => 0, 'dinas_luar' => 0, 'izin' => 0, 'sakit' => 0, 'cuti' => 0, 'alpha' => 0];
        $belumBerlangsung = 0;

        foreach ($hariWajib as $tgl) {
            $cutiDiajukan = false;
            foreach ($izin as $z) {
                if ($z['jenis'] === 'cuti' && $tgl >= $z['tanggal_mulai'] && $tgl <= $z['tanggal_selesai']) {
                    $cutiDiajukan = true;
                    break;
                }
            }

            if ($cutiDiajukan) {
                $status = 'cuti';
            } elseif (isset($absensi[$tgl])) {
                $status = $absensi[$tgl]['status'];
            } else {
                $status = null;
                foreach ($izin as $z) {
                    if ($tgl >= $z['tanggal_mulai'] && $tgl <= $z['tanggal_selesai']) {
                        $status = $z['jenis'];
                        break;
                    }
                }
                if ($status === null) {
                    if ($tgl >= $today) {
                        $belumBerlangsung++;
                        continue;
                    }
                    $status = 'alpha';
                }
            }
            if (isset($hitung[$status])) {
                $hitung[$status]++;
            }
        }

        // --- menit (semua baris absensi di periode, termasuk hari non-kerja) ---
        $menitTelat = 0;
        foreach ($absensi as $a) {
            $menitTelat  += (int) $a['menit_terlambat'];
        }

        $hadirBayar = $hitung['hadir'] + $hitung['terlambat'] + $hitung['dinas_luar'];

        // --- gaji pokok ---
        if ($jenis === 'harian') {
            $tarifHarian = $gajiDasar;
            $hariDibayar = $hadirBayar;
            $gajiPokok   = round($tarifHarian * $hariDibayar, 2);
            $ketPokok    = $hariDibayar . ' hari x ' . $this->rp($tarifHarian);
        } else {
            $tarifHarian = $totalPeriode > 0 ? $gajiDasar / $totalPeriode : 0.0;
            if ($totalPeriode > 0 && $totalWajib < $totalPeriode) {
                $gajiPokok = round($gajiDasar * $totalWajib / $totalPeriode, 2);
                $ketPokok  = "Gaji pokok bulanan (prorata {$totalWajib}/{$totalPeriode} hari kerja)";
            } else {
                $gajiPokok = round($gajiDasar, 2);
                $ketPokok  = 'Gaji pokok bulanan';
            }
            if ($hitung['cuti'] > 0) {
                $hariCutiTidakDibayar = min($hitung['cuti'], $totalWajib);
                $gajiPokok = round(max(0, $gajiPokok - ($tarifHarian * $hariCutiTidakDibayar)), 2);
                $ketPokok .= " setelah {$hariCutiTidakDibayar} hari cuti tidak dibayar";
            }
        }

        $pend = [];
        $pot  = [];
        $pend[] = $this->baris(null, 'Gaji pokok', 'pendapatan', $ketPokok, $gajiPokok);

        $tunjangan = 0.0;

        // --- komponen yang dipasang ke karyawan ---
        $khusus = [self::KODE_BPJS, self::KODE_TELAT, self::KODE_ALPHA];
        foreach ($assigned as $komponenId => $nilai) {
            $m = $komponen[$komponenId] ?? null;
            if (! $m || ! (int) $m['aktif'] || in_array($m['kode'], $khusus, true)) {
                continue;
            }

            switch ($m['metode']) {
                case 'nominal_tetap':
                    $jml = $nilai;
                    $ket = null;
                    break;
                case 'persen':
                    $jml = $gajiPokok * $nilai / 100;
                    $ket = $this->angka($nilai) . '% dari gaji pokok';
                    break;
                case 'per_hari':
                    $jml = $hadirBayar * $nilai;
                    $ket = $hadirBayar . ' hari x ' . $this->rp($nilai);
                    break;
                case 'per_menit':
                    $jml = $menitTelat * $nilai;
                    $ket = $menitTelat . ' menit x ' . $this->rp($nilai);
                    break;
                default:
                    $jml = 0;
                    $ket = null;
            }
            $jml = round($jml, 2);
            if ($jml <= 0) {
                continue;
            }

            if ($m['tipe'] === 'pendapatan') {
                $pend[]    = $this->baris((int) $m['id'], $m['nama'], 'pendapatan', $ket, $jml);
                $tunjangan += $jml;
            } else {
                $pot[] = $this->baris((int) $m['id'], $m['nama'], 'potongan', $ket, $jml);
            }
        }

        // --- komponen otomatis: keterlambatan ---
        $telat = $this->aturan(self::KODE_TELAT, $byKode, $assigned, false);
        if ($telat && $telat['nilai'] !== null && $menitTelat > 0) {
            $jml = round($menitTelat * $telat['nilai'], 2);
            if ($jml > 0) {
                $pot[] = $this->baris((int) $telat['m']['id'], $telat['m']['nama'], 'potongan', $menitTelat . ' menit x ' . $this->rp($telat['nilai']), $jml);
            }
        }

        // --- komponen otomatis: alpha (hanya karyawan bulanan) ---
        $alpha = $this->aturan(self::KODE_ALPHA, $byKode, $assigned);
        if ($jenis === 'bulanan' && $alpha && $hitung['alpha'] > 0) {
            $rate = $alpha['nilai'] ?? $tarifHarian;
            $jml  = round($hitung['alpha'] * $rate, 2);
            if ($jml > 0) {
                $pot[] = $this->baris((int) $alpha['m']['id'], $alpha['m']['nama'], 'potongan', $hitung['alpha'] . ' hari x ' . $this->rp($rate), $jml);
            }
        }

        $bpjs = $this->aturan(self::KODE_BPJS, $byKode, $assigned);
        if ($bpjs && $bpjs['nilai'] !== null) {
            $jml = round($gajiPokok * $bpjs['nilai'] / 100, 2);
            if ($jml > 0) {
                $pot[] = $this->baris(
                    (int) $bpjs['m']['id'],
                    $bpjs['m']['nama'],
                    'potongan',
                    $this->angka($bpjs['nilai']) . '% dari gaji pokok',
                    $jml
                );
            }
        }

        // --- total ---
        $totalPend = round($gajiPokok + $tunjangan, 2);
        $totalPot  = 0.0;
        foreach ($pot as $p) {
            $totalPot += $p['jumlah'];
        }
        $bersih = round($totalPend - $totalPot, 2);
        if ($bersih < 0) {
            throw new \DomainException('Total potongan melebihi total pendapatan. Sesuaikan komponen potongan karyawan sebelum menghitung payroll.');
        }

        $rekap = [
            'jenis_penggajian'    => $jenis,
            'hari_kerja_periode'  => $totalPeriode,
            'hari_wajib'          => $totalWajib,
            'hadir'               => $hitung['hadir'],
            'terlambat'           => $hitung['terlambat'],
            'dinas_luar'          => $hitung['dinas_luar'],
            'izin'                => $hitung['izin'],
            'sakit'               => $hitung['sakit'],
            'cuti'                => $hitung['cuti'],
            'alpha'               => $hitung['alpha'],
            'belum_berlangsung'   => $belumBerlangsung,
            'menit_terlambat'     => $menitTelat,
            'gaji_pokok_dasar'    => $gajiDasar,
            'peringatan'          => [],
        ];

        return [
            'penggajian' => [
                'karyawan_id'      => (int) $k['id'],
                'gaji_pokok'       => $gajiPokok,
                'tunjangan'        => $tunjangan,
                'total_pendapatan' => $totalPend,
                'total_potongan'   => $totalPot,
                'gaji_bersih'      => $bersih,
                'tarif_harian'     => round($tarifHarian, 2),
                'rekap_json'       => json_encode($rekap, JSON_UNESCAPED_UNICODE),
            ],
            'detail' => array_merge($pend, $pot),
        ];
    }

    /** Ambil nilai karyawan, dengan opsi memakai nilai master bila belum ada input khusus. */
    private function aturan(string $kode, array $byKode, array $assigned, bool $pakaiDefault = true): ?array
    {
        $m = $byKode[$kode] ?? null;
        if (! $m || ! (int) $m['aktif']) {
            return null;
        }
        $id    = (int) $m['id'];
        if (! array_key_exists($id, $assigned) && ! $pakaiDefault) {
            return null;
        }
        $nilai = array_key_exists($id, $assigned)
            ? (float) $assigned[$id]
            : ($m['nilai'] === null ? null : (float) $m['nilai']);

        return ['m' => $m, 'nilai' => $nilai];
    }

    private function baris(?int $komponenId, string $nama, string $tipe, ?string $ket, float $jumlah): array
    {
        return ['komponen_id' => $komponenId, 'nama' => $nama, 'tipe' => $tipe, 'keterangan' => $ket, 'jumlah' => $jumlah];
    }

    private function rp(float $n): string
    {
        return number_format($n, floor($n) == $n ? 0 : 2, ',', '.');
    }

    private function angka(float $n): string
    {
        return rtrim(rtrim(number_format($n, 2, ',', '.'), '0'), ',');
    }
}