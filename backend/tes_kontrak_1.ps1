# Tes otomatis tahap 1: format umum, pengajuan, dan notifikasi sesuai kontrak.
# Syarat: php spark serve sedang jalan di terminal lain (restart dulu setelah setup).
#   powershell -ExecutionPolicy Bypass -File .\tes_kontrak_1.ps1
param([string]$ApiUrl = "http://localhost:8080/api/v1")

$script:lulus = 0
$script:gagal = 0
$inv = [System.Globalization.CultureInfo]::InvariantCulture

function Panggil($metode, $path, $token, $body = $null) {
    $p = @{ Method = $metode; Uri = "$ApiUrl$path"; ContentType = "application/json"; UseBasicParsing = $true }
    if ($token) { $p.Headers = @{ Authorization = "Bearer $token" } }
    if ($null -ne $body) { $p.Body = ($body | ConvertTo-Json -Depth 8) }

    $status = 0
    $raw    = $null
    try {
        $r      = Invoke-WebRequest @p
        $status = [int]$r.StatusCode
        $raw    = $r.Content
    } catch {
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $raw = $_.ErrorDetails.Message }
        if (-not $raw -and $_.Exception.Response) {
            try {
                $sr  = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $raw = $sr.ReadToEnd()
            } catch { }
        }
        if ($status -eq 0) { $raw = "KONEKSI GAGAL: " + $_.Exception.Message }
    }

    # parse JSON dipisah dari pengambilan status, supaya status asli tetap terbaca
    $json = $null
    if ($raw) { try { $json = $raw | ConvertFrom-Json } catch { } }
    return @{ status = $status; json = $json; raw = $raw }
}

function Cek($nama, $kondisi, $info = "") {
    if ($kondisi) { $script:lulus++; Write-Host "  LULUS  $nama" -ForegroundColor Green }
    else { $script:gagal++; Write-Host "  GAGAL  $nama   $info" -ForegroundColor Red }
}

function Sama($a, $b) { return ([math]::Abs([double]$a - [double]$b) -lt 0.01) }
function Tgl($d) { return ([datetime]$d).ToString("yyyy-MM-dd", $inv) }

function Login($email) {
    $r = Panggil "POST" "/auth/login" $null @{ email = $email; password = "Password123!" }
    if ($r.status -ne 200) { throw "Login $email gagal (status $($r.status)). Server nyala?" }
    return $r.json.data.access_token
}

Write-Host "== Login ==" -ForegroundColor Cyan
$rina    = Login "rina@hadirpay.test"
$andi    = Login "andi@hadirpay.test"
$pemilik = Login "pemilik@hadirpay.test"
$budi    = Login "budi@hadirpay.test"
$budiKid = [int](Panggil "GET" "/auth/me" $budi).json.data.karyawan_id
$andiKid = [int](Panggil "GET" "/auth/me" $andi).json.data.karyawan_id
Write-Host "  4 akun berhasil login"

# Pemeriksaan awal: pastikan server membalas JSON yang benar
$t = Panggil "GET" "/departemen?per_page=1" $rina
if (-not $t.json) {
    Write-Host "  PERINGATAN: GET /departemen tidak mengembalikan JSON yang valid. status=$($t.status)" -ForegroundColor Yellow
    $potong = if ($t.raw) { $t.raw.Substring(0, [math]::Min(500, $t.raw.Length)) } else { "(kosong)" }
    Write-Host "  Isi respons: $potong" -ForegroundColor Yellow
    Write-Host "  Kirim potongan ini ke saya. Biasanya ini error PHP yang tercetak sebelum JSON." -ForegroundColor Yellow
}

# tanggal acak supaya tes bisa diulang (Senin di 2027-2029, hari Minggu di 2024, hari acak di 2024)
$tglDasar        = [datetime]::ParseExact("2027-01-04", "yyyy-MM-dd", $inv).AddDays(7 * [int](Get-Random -Minimum 0 -Maximum 150))
$cutiMulai   = Tgl $tglDasar
$cutiSelesai = Tgl ($tglDasar.AddDays(2))
$lemburTgl   = Tgl ([datetime]::ParseExact("2024-01-07", "yyyy-MM-dd", $inv).AddDays(7 * [int](Get-Random -Minimum 0 -Maximum 50)))
$koreksiTgl  = Tgl ([datetime]::ParseExact("2024-01-02", "yyyy-MM-dd", $inv).AddDays([int](Get-Random -Minimum 0 -Maximum 360)))
$tglSakit    = Tgl ($tglDasar.AddDays(7))
$tglBatal    = Tgl ($tglDasar.AddDays(14))
$tglBulkA    = Tgl ($tglDasar.AddDays(21))
$tglBulkB    = Tgl ($tglDasar.AddDays(28))

Write-Host "== A. Format umum ==" -ForegroundColor Cyan
$r = Panggil "GET" "/departemen?per_page=1" $rina
$idDept = @($r.json.data)[0].id
$tipeId = if ($null -ne $idDept) { $idDept.GetType().Name } else { "(kosong)" }
Cek "ID berupa angka, bukan teks" ($idDept -is [int] -or $idDept -is [long]) "tipe=$tipeId status=$($r.status) (cek numberNative di Config/Database.php)"
$r = Panggil "POST" "/pengajuan" $budi @{}
Cek "Validasi gagal -> 422 dan errors berupa array" ($r.status -eq 422 -and $r.json.errors.jenis -is [array]) "status=$($r.status) raw=$($r.raw)"
$r = Panggil "POST" "/departemen" $rina @{}
Cek "Departemen: validasi gagal juga berupa array" ($r.json.errors.nama -is [array]) "status=$($r.status)"

Write-Host "== B. Pengajuan sisi karyawan ==" -ForegroundColor Cyan
$r = Panggil "GET" "/pengajuan/kuota?tahun=$($tglDasar.Year)" $budi
Cek "Kuota -> 200 (tahun, cuti_tahunan_total, cuti_terpakai, cuti_sisa)" ($r.status -eq 200 -and $null -ne $r.json.data.cuti_sisa -and $null -ne $r.json.data.cuti_tahunan_total) "status=$($r.status)"
$terpakaiAwal = [double]$r.json.data.cuti_terpakai

Cek "Jenis tidak valid -> 422" ((Panggil "POST" "/pengajuan" $budi @{ jenis = "ngawur"; tanggal_mulai = $cutiMulai }).status -eq 422)

$r = Panggil "POST" "/pengajuan" $budi @{ jenis = "cuti"; tanggal_mulai = $cutiMulai; tanggal_selesai = $cutiSelesai; alasan = "Tes kontrak" }
Cek "Ajukan cuti -> 201, status menunggu, ada judul dan karyawan" ($r.status -eq 201 -and $r.json.data.status -eq "menunggu" -and $r.json.data.judul -and $r.json.data.karyawan.nama) "status=$($r.status) $($r.json.message)"
$cuti   = $r.json.data
$cutiId = $cuti.id
Cek "jumlah_hari antara 1 dan 3 (akhir pekan dan libur tidak dihitung)" ($cuti.jumlah_hari -ge 1 -and $cuti.jumlah_hari -le 3) "jumlah_hari=$($cuti.jumlah_hari)"
Cek "tanggal_diajukan berformat YYYY-MM-DD" ($cuti.tanggal_diajukan -match '^\d{4}-\d{2}-\d{2}$')
Cek "Tanggal bentrok -> 409" ((Panggil "POST" "/pengajuan" $budi @{ jenis = "cuti"; tanggal_mulai = $cutiMulai; tanggal_selesai = $cutiSelesai }).status -eq 409)
$r = Panggil "POST" "/pengajuan" $budi @{ jenis = "cuti"; tanggal_mulai = "2030-03-04"; tanggal_selesai = "2030-04-30" }
Cek "Kuota tidak cukup -> 422 INSUFFICIENT_LEAVE_QUOTA" ($r.status -eq 422 -and $r.json.code -eq "INSUFFICIENT_LEAVE_QUOTA") "status=$($r.status) code=$($r.json.code)"

Cek "Lembur tanpa jam -> 422" ((Panggil "POST" "/pengajuan" $budi @{ jenis = "lembur"; tanggal_mulai = $lemburTgl }).status -eq 422)
$r = Panggil "POST" "/pengajuan" $budi @{ jenis = "lembur"; tanggal_mulai = $lemburTgl; jam_mulai = "17:00"; jam_selesai = "20:00"; alasan = "Tes lembur" }
Cek "Ajukan lembur -> 201, durasi 180 menit" ($r.status -eq 201 -and $r.json.data.lembur.durasi_menit -eq 180) "status=$($r.status) $($r.json.message)"
$lemburId = $r.json.data.id

Cek "Koreksi tanpa jam -> 422" ((Panggil "POST" "/pengajuan" $budi @{ jenis = "koreksi_absensi"; tanggal_mulai = $koreksiTgl }).status -eq 422)
$r = Panggil "POST" "/pengajuan" $budi @{ jenis = "koreksi_absensi"; tanggal_mulai = $koreksiTgl; jam_masuk_benar = "07:55"; jam_pulang_benar = "17:00"; alasan = "Tes koreksi" }
Cek "Ajukan koreksi -> 201, ada data_koreksi" ($r.status -eq 201 -and $r.json.data.data_koreksi.jam_masuk_benar -eq "07:55") "status=$($r.status) $($r.json.message)"
$koreksiId = $r.json.data.id

$r = Panggil "GET" "/pengajuan?per_page=100" $budi
$mine = @($r.json.data)
Cek "Daftar pengajuan Budi -> 200, hanya miliknya, ada ringkasan" ($r.status -eq 200 -and $mine.Count -ge 3 -and -not ($mine | Where-Object { $_.karyawan.id -ne $budiKid }) -and $null -ne $r.json.ringkasan.menunggu) "status=$($r.status)"
$r = Panggil "GET" "/pengajuan/$koreksiId" $budi
Cek "Detail koreksi -> 200 (data_koreksi.jam_pulang_benar)" ($r.status -eq 200 -and $r.json.data.data_koreksi.jam_pulang_benar -eq "17:00")
$r = Panggil "GET" "/pengajuan/$lemburId" $budi
Cek "Detail lembur -> 200 (lembur.jam_mulai)" ($r.status -eq 200 -and $r.json.data.lembur.jam_mulai -eq "17:00")
$r = Panggil "GET" "/pengajuan?per_page=100" $andi
Cek "Keuangan hanya melihat pengajuan miliknya" ($r.status -eq 200 -and -not (@($r.json.data) | Where-Object { $_.karyawan.id -ne $andiKid }))
$r = Panggil "GET" "/pengajuan?per_page=100" $rina
Cek "Admin HRD melihat semua pengajuan (termasuk milik Budi)" (@(@($r.json.data) | Where-Object { [int]$_.id -eq [int]$cutiId }).Count -ge 1) "status=$($r.status) total=$($r.json.meta.total) cutiId=$cutiId"
Cek "Pemilik buka pengajuan -> 403" ((Panggil "GET" "/pengajuan" $pemilik).status -eq 403)
Cek "Karyawan setujui -> 403" ((Panggil "POST" "/pengajuan/$cutiId/setujui" $budi @{}).status -eq 403)
Cek "Karyawan bulk-proses -> 403" ((Panggil "POST" "/pengajuan/bulk-proses" $budi @{ ids = @($cutiId); aksi = "setujui" }).status -eq 403)

Write-Host "== C. Notifikasi dari pengajuan ==" -ForegroundColor Cyan
$r = Panggil "GET" "/notifikasi?belum_dibaca=true&per_page=100" $rina
$nAdmin = @($r.json.data) | Where-Object { $_.tautan -eq "/app/pengajuan?id=$cutiId" } | Select-Object -First 1
Cek "Admin HRD dapat notifikasi pengajuan baru" ($r.status -eq 200 -and $nAdmin -and $nAdmin.tipe -eq "pengajuan" -and $nAdmin.dibaca -eq $false) "status=$($r.status)"
Cek "Respons ada jumlah_belum_dibaca di level atas" ($null -ne $r.json.jumlah_belum_dibaca -and [int]$r.json.jumlah_belum_dibaca -ge 1)
Cek "dibuat_pada berformat ISO +07:00" ($nAdmin.dibuat_pada -match '\+07:00$') "dibuat_pada=$($nAdmin.dibuat_pada)"

Write-Host "== D. Proses oleh admin HRD ==" -ForegroundColor Cyan
$r = Panggil "POST" "/pengajuan/$cutiId/setujui" $rina @{}
Cek "Setujui cuti -> 200 disetujui, diproses_oleh berlabel (HRD)" ($r.status -eq 200 -and $r.json.data.status -eq "disetujui" -and $r.json.data.diproses_oleh.label -like "*(HRD)") "status=$($r.status) $($r.json.message)"
Cek "Setujui dua kali -> 409" ((Panggil "POST" "/pengajuan/$cutiId/setujui" $rina @{}).status -eq 409)

$r = Panggil "GET" "/pengajuan/kuota?tahun=$($tglDasar.Year)" $budi
Cek "Kuota terpakai bertambah sesuai jumlah_hari" (Sama ([double]$r.json.data.cuti_terpakai) ($terpakaiAwal + [double]$cuti.jumlah_hari)) "awal=$terpakaiAwal sekarang=$($r.json.data.cuti_terpakai) jumlah_hari=$($cuti.jumlah_hari)"

$r = Panggil "GET" "/absensi/riwayat?periode=$($cutiMulai.Substring(0,7))&per_page=100" $budi
$baris = @(@($r.json.data.riwayat) | Where-Object { $_.status -eq "cuti" -and $_.tanggal -ge $cutiMulai -and $_.tanggal -le $cutiSelesai })
Cek "Cuti yang disetujui masuk ke absensi (status cuti)" ($baris.Count -ge 1) "baris cuti ditemukan: $($baris.Count) status=$($r.status)"

Cek "Setujui koreksi -> 200" ((Panggil "POST" "/pengajuan/$koreksiId/setujui" $rina @{}).status -eq 200)
$r = Panggil "GET" "/absensi/riwayat?periode=$($koreksiTgl.Substring(0,7))&per_page=100" $budi
$row = @($r.json.data.riwayat) | Where-Object { $_.tanggal -eq $koreksiTgl } | Select-Object -First 1
Cek "Koreksi mengubah absensi (jam masuk 07:55, koreksi_pengajuan_id terisi)" ($row -and $row.jam_masuk -eq "07:55" -and $row.koreksi_pengajuan_id -eq $koreksiId) "baris=$($row | ConvertTo-Json -Compress)"

Cek "Setujui lembur (hari Minggu) -> 200" ((Panggil "POST" "/pengajuan/$lemburId/setujui" $rina @{}).status -eq 200)
$r = Panggil "GET" "/absensi/riwayat?periode=$($lemburTgl.Substring(0,7))&per_page=100" $budi
$row = @($r.json.data.riwayat) | Where-Object { $_.tanggal -eq $lemburTgl } | Select-Object -First 1
Cek "Lembur hari libur tercatat di absensi (17:00 sampai 20:00)" ($row -and $row.jam_masuk -eq "17:00" -and $row.jam_pulang -eq "20:00") "baris=$($row | ConvertTo-Json -Compress)"

$r = Panggil "POST" "/pengajuan" $budi @{ jenis = "sakit"; tanggal_mulai = $tglSakit; tanggal_selesai = $tglSakit; alasan = "Tes tolak" }
$sakitId = $r.json.data.id
Cek "Tolak tanpa alasan -> 422" ((Panggil "POST" "/pengajuan/$sakitId/tolak" $rina @{}).status -eq 422)
$r = Panggil "POST" "/pengajuan/$sakitId/tolak" $rina @{ alasan_penolakan = "Dokumen tidak lengkap" }
Cek "Tolak dengan alasan -> 200 ditolak" ($r.status -eq 200 -and $r.json.data.status -eq "ditolak" -and $r.json.data.alasan_penolakan -eq "Dokumen tidak lengkap") "status=$($r.status)"

Write-Host "== E. Bulk proses dan batalkan ==" -ForegroundColor Cyan
$a = (Panggil "POST" "/pengajuan" $budi @{ jenis = "izin"; tanggal_mulai = $tglBulkA; tanggal_selesai = $tglBulkA }).json.data.id
$b = (Panggil "POST" "/pengajuan" $budi @{ jenis = "izin"; tanggal_mulai = $tglBulkB; tanggal_selesai = $tglBulkB }).json.data.id
$r = Panggil "POST" "/pengajuan/bulk-proses" $rina @{ ids = @($a, $b); aksi = "tolak"; alasan_penolakan = "Tes bulk" }
Cek "Bulk tolak 2 pengajuan -> berhasil 2, gagal 0" ($r.status -eq 200 -and @($r.json.data.berhasil).Count -eq 2 -and @($r.json.data.gagal).Count -eq 0) "status=$($r.status)"
$r = Panggil "POST" "/pengajuan/bulk-proses" $rina @{ ids = @($a, 99999999); aksi = "setujui" }
Cek "Bulk: sudah diproses dan tidak ada -> berhasil 0, gagal 2" ($r.status -eq 200 -and @($r.json.data.berhasil).Count -eq 0 -and @($r.json.data.gagal).Count -eq 2)
Cek "Bulk dengan aksi salah -> 422" ((Panggil "POST" "/pengajuan/bulk-proses" $rina @{ ids = @($a); aksi = "hapus" }).status -eq 422)

$batalId = (Panggil "POST" "/pengajuan" $budi @{ jenis = "izin"; tanggal_mulai = $tglBatal; tanggal_selesai = $tglBatal }).json.data.id
Cek "Admin HRD batalkan milik orang lain -> 403" ((Panggil "DELETE" "/pengajuan/$batalId" $rina).status -eq 403)
Cek "Karyawan batalkan miliknya -> 200" ((Panggil "DELETE" "/pengajuan/$batalId" $budi).status -eq 200)
Cek "Status pengajuan yang dibatalkan = dibatalkan" ((Panggil "GET" "/pengajuan/$batalId" $budi).json.data.status -eq "dibatalkan")
Cek "Batalkan pengajuan yang sudah disetujui -> 409" ((Panggil "DELETE" "/pengajuan/$cutiId" $budi).status -eq 409)

Write-Host "== F. Notifikasi karyawan ==" -ForegroundColor Cyan
$r = Panggil "GET" "/notifikasi?per_page=100" $budi
$nBudi = @($r.json.data) | Where-Object { $_.tautan -eq "/app/pengajuan?id=$cutiId" -and $_.judul -like "*disetujui*" } | Select-Object -First 1
Cek "Karyawan dapat notifikasi pengajuan disetujui" ($nBudi -and $nBudi.tipe -eq "pengajuan" -and $nBudi.dibaca -eq $false)
Cek "Notifikasi karyawan lain -> 404 saat dibaca" ((Panggil "PATCH" "/notifikasi/$($nBudi.id)/baca" $rina).status -eq 404)
Cek "Tandai dibaca -> 200" ((Panggil "PATCH" "/notifikasi/$($nBudi.id)/baca" $budi).status -eq 200)
$r = Panggil "GET" "/notifikasi?belum_dibaca=true&per_page=100" $budi
Cek "Yang sudah dibaca tidak muncul di daftar belum dibaca" (-not (@($r.json.data) | Where-Object { $_.id -eq $nBudi.id }))
Cek "Baca semua -> 200" ((Panggil "POST" "/notifikasi/baca-semua" $budi).status -eq 200)
Cek "Setelah baca semua, jumlah_belum_dibaca = 0" ([int](Panggil "GET" "/notifikasi" $budi).json.jumlah_belum_dibaca -eq 0)
Cek "Tanpa token -> 401" ((Panggil "GET" "/notifikasi" $null).status -eq 401)

Write-Host "== G. Hak akses baru ==" -ForegroundColor Cyan
Cek "Keuangan baca daftar karyawan -> 200" ((Panggil "GET" "/karyawan" $andi).status -eq 200)
Cek "Pemilik baca daftar karyawan -> 200" ((Panggil "GET" "/karyawan" $pemilik).status -eq 200)
Cek "Karyawan baca daftar karyawan -> 403" ((Panggil "GET" "/karyawan" $budi).status -eq 403)
Cek "Keuangan tambah karyawan -> 403" ((Panggil "POST" "/karyawan" $andi @{}).status -eq 403)
Cek "Keuangan baca komponen gaji -> 200" ((Panggil "GET" "/komponen-gaji" $andi).status -eq 200)
Cek "Pemilik baca komponen gaji -> 403" ((Panggil "GET" "/komponen-gaji" $pemilik).status -eq 403)

Write-Host ""
$warna = if ($script:gagal -eq 0) { "Green" } else { "Red" }
Write-Host "HASIL: $($script:lulus) lulus, $($script:gagal) gagal" -ForegroundColor $warna
if ($script:gagal -gt 0) { Write-Host "Kirim ke saya baris yang GAGAL beserta infonya." }
Write-Host ""
Write-Host "Data uji tersisa (absensi 2024 dan 2027 ke atas, pengajuan, kuota). Bersihkan lewat SQL bila perlu:"
Write-Host "  DELETE FROM absensi WHERE sumber IN ('koreksi','sistem') AND (tanggal < '2025-01-01' OR tanggal >= '2027-01-01');"
Write-Host "  DELETE FROM pengajuan_izin WHERE tanggal_mulai < '2025-01-01' OR tanggal_mulai >= '2027-01-01';"
Write-Host "  UPDATE kuota_cuti SET terpakai = 0 WHERE tahun >= 2027;"
