# Tes otomatis tahap 3: absensi admin, rekap, export, rekap-absensi payroll, dan pengaturan.
#   powershell -ExecutionPolicy Bypass -File .\tes_kontrak_3.ps1
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
    $json = $null
    if ($raw) { try { $json = $raw | ConvertFrom-Json } catch { } }
    return @{ status = $status; json = $json; raw = $raw }
}

function Cek($nama, $kondisi, $info = "") {
    if ($kondisi) { $script:lulus++; Write-Host "  LULUS  $nama" -ForegroundColor Green }
    else { $script:gagal++; Write-Host "  GAGAL  $nama   $info" -ForegroundColor Red }
}

function Angka($v) { return ($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) }
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
Write-Host "  4 akun berhasil login"

Write-Host "== A. Absensi harian (GET /absensi) ==" -ForegroundColor Cyan
$hariIni = Tgl (Get-Date)
$r = Panggil "GET" "/absensi?tanggal=$hariIni&per_page=5" $rina
Cek "GET /absensi -> 200, ada meta.total dan ringkasan" ($r.status -eq 200 -and $r.json.meta.total -ge 1 -and $null -ne $r.json.ringkasan.hadir -and $null -ne $r.json.ringkasan.alpha) "status=$($r.status) $($r.raw)"
$a1 = @($r.json.data)[0]
Cek "Baris: karyawan{kode,inisial}, departemen, tanggal, jam_masuk dan status (boleh null)" ($a1.karyawan.kode -and $a1.karyawan.inisial -and $a1.departemen -and $a1.tanggal -eq $hariIni -and ($a1.PSObject.Properties.Name -contains "status") -and ($a1.PSObject.Properties.Name -contains "jam_masuk")) "baris=$($a1 | ConvertTo-Json -Compress)"
Cek "Pagination: per_page=5 -> maksimal 5 baris" (@($r.json.data).Count -le 5)
$dept = @((Panggil "GET" "/departemen?per_page=1" $rina).json.data)[0]
$r = Panggil "GET" "/absensi?departemen_id=$($dept.id)&per_page=100" $rina
Cek "Filter departemen_id" ($r.status -eq 200 -and -not (@($r.json.data) | Where-Object { $_.departemen -ne $dept.nama })) "status=$($r.status)"
$r = Panggil "GET" "/absensi?status=belum_absen&tanggal=2020-01-06&per_page=100" $rina
Cek "Filter status=belum_absen (tanggal tanpa data) -> semua status null" ($r.status -eq 200 -and $r.json.meta.total -ge 1 -and -not (@($r.json.data) | Where-Object { $null -ne $_.status }))
Cek "Tanggal salah -> 422" ((Panggil "GET" "/absensi?tanggal=bukan-tanggal" $rina).status -eq 422)
Cek "Pemilik baca /absensi -> 200" ((Panggil "GET" "/absensi" $pemilik).status -eq 200)
Cek "Keuangan baca /absensi -> 403" ((Panggil "GET" "/absensi" $andi).status -eq 403)
Cek "Karyawan baca /absensi -> 403" ((Panggil "GET" "/absensi" $budi).status -eq 403)

Write-Host "== B. Data uji: koreksi absensi Budi ==" -ForegroundColor Cyan
$awal = [datetime]::ParseExact("2024-01-02", "yyyy-MM-dd", $inv)
$tglK = $null
for ($i = 0; $i -lt 8 -and -not $tglK; $i++) {
    $cand = Tgl ($awal.AddDays([int](Get-Random -Minimum 0 -Maximum 360)))
    $rk = Panggil "POST" "/pengajuan" $budi @{ jenis = "koreksi_absensi"; tanggal_mulai = $cand; jam_masuk_benar = "07:55"; jam_pulang_benar = "17:00"; alasan = "Tes tahap 3" }
    if ($rk.status -eq 201) { $tglK = $cand; $idK = $rk.json.data.id }
}
Cek "Ajukan koreksi uji -> 201" ($null -ne $tglK) "status=$($rk.status) $($rk.raw)"
$r = Panggil "POST" "/pengajuan/$idK/setujui" $rina @{}
Cek "Setujui koreksi uji -> 200" ($r.status -eq 200) "status=$($r.status) $($r.raw)"

$r = Panggil "GET" "/absensi?tanggal=$tglK&search=Budi" $rina
$bb = @($r.json.data) | Where-Object { $_.karyawan.nama -like "*Budi*" } | Select-Object -First 1
Cek "Absensi Budi di tanggal koreksi: jam 07:55 sampai 17:00, status hadir" ($bb -and $bb.jam_masuk -eq "07:55" -and $bb.jam_pulang -eq "17:00" -and $bb.status -eq "hadir") "baris=$($bb | ConvertTo-Json -Compress)"
Cek "ringkasan.hadir >= 1 pada tanggal itu" ([int]$r.json.ringkasan.hadir -ge 1) "ringkasan=$($r.json.ringkasan | ConvertTo-Json -Compress)"

Write-Host "== C. Export CSV ==" -ForegroundColor Cyan
$r = Panggil "GET" "/absensi/export?tanggal=$tglK" $rina
Cek "Export -> 200, CSV berisi header Kode dan Budi" ($r.status -eq 200 -and $r.raw -match "Kode" -and $r.raw -match "Budi") "status=$($r.status) awal=$(if ($r.raw) { $r.raw.Substring(0, [math]::Min(120, $r.raw.Length)) })"
Cek "Export: pemilik -> 403" ((Panggil "GET" "/absensi/export?tanggal=$tglK" $pemilik).status -eq 403)
Cek "Export: keuangan -> 403" ((Panggil "GET" "/absensi/export?tanggal=$tglK" $andi).status -eq 403)

Write-Host "== D. Rekap bulanan (GET /absensi/rekap) ==" -ForegroundColor Cyan
$per = $tglK.Substring(0, 7)
$r = Panggil "GET" "/absensi/rekap?periode=$per&search=Budi" $rina
$rk1 = @($r.json.data.karyawan) | Where-Object { $_.nama -like "*Budi*" } | Select-Object -First 1
Cek "Rekap -> 200, ringkasan dan karyawan (hari_kerja angka, hadir >= 1)" ($r.status -eq 200 -and (Angka $r.json.data.ringkasan.total_karyawan) -and $rk1 -and (Angka $rk1.hari_kerja) -and $rk1.hadir -ge 1) "status=$($r.status) $($r.raw)"
Cek "Rekap: ada jam_lembur_menit dan total_menit_terlambat" ($rk1 -and ($rk1.PSObject.Properties.Name -contains "jam_lembur_menit") -and ($rk1.PSObject.Properties.Name -contains "total_menit_terlambat"))
Cek "Rekap: meta.total ada" ($null -ne $r.json.meta.total)
Cek "Rekap tanpa periode -> 422" ((Panggil "GET" "/absensi/rekap" $rina).status -eq 422)
Cek "Rekap: keuangan -> 200" ((Panggil "GET" "/absensi/rekap?periode=$per" $andi).status -eq 200)
Cek "Rekap: pemilik -> 200" ((Panggil "GET" "/absensi/rekap?periode=$per" $pemilik).status -eq 200)
Cek "Rekap: karyawan -> 403" ((Panggil "GET" "/absensi/rekap?periode=$per" $budi).status -eq 403)

Write-Host "== E. Rekap absensi untuk payroll ==" -ForegroundColor Cyan
$r = Panggil "GET" "/periode-gaji" $rina
$pid1 = @($r.json.data)[0].id
if ($null -eq $pid1) {
    Write-Host "  (dilewati: belum ada periode gaji)" -ForegroundColor DarkGray
} else {
    $r = Panggil "GET" "/periode-gaji/$pid1/rekap-absensi" $rina
    Cek "rekap-absensi -> 200, ada karyawan, ringkasan, peringatan (array)" ($r.status -eq 200 -and @($r.json.data.karyawan).Count -ge 1 -and $null -ne $r.json.data.ringkasan -and ($r.json.data.PSObject.Properties.Name -contains "peringatan")) "status=$($r.status) $($r.raw)"
    Cek "rekap-absensi: keuangan -> 200" ((Panggil "GET" "/periode-gaji/$pid1/rekap-absensi" $andi).status -eq 200)
    Cek "rekap-absensi: karyawan -> 403" ((Panggil "GET" "/periode-gaji/$pid1/rekap-absensi" $budi).status -eq 403)
}
Cek "rekap-absensi: periode tidak ada -> 404" ((Panggil "GET" "/periode-gaji/99999999/rekap-absensi" $rina).status -eq 404)

Write-Host "== F. Pengaturan (susunan kontrak) ==" -ForegroundColor Cyan
$r = Panggil "GET" "/pengaturan" $rina
$keys = if ($r.json.data) { @($r.json.data.PSObject.Properties.Name) } else { @() }
Write-Host ("  Key yang ada: " + ($keys -join ", ")) -ForegroundColor DarkGray
foreach ($kk in "perusahaan", "jadwal_kerja", "kebijakan_gaji", "kuota_cuti_tahunan", "lokasi_absensi") {
    Cek "Ada key $kk" ($keys -contains $kk) "key ada: $($keys -join ',')"
}
$jk = $r.json.data.jadwal_kerja
Cek "jadwal_kerja: jam_masuk HH:mm, toleransi angka, hari_kerja array" ($jk.jam_masuk -match '^\d{2}:\d{2}$' -and $jk.jam_pulang -match '^\d{2}:\d{2}$' -and (Angka $jk.toleransi_menit) -and @($jk.hari_kerja).Count -ge 1) "jadwal=$($jk | ConvertTo-Json -Compress)"
Cek "kuota_cuti_tahunan berupa angka" (Angka $r.json.data.kuota_cuti_tahunan)
$r2 = Panggil "PUT" "/pengaturan" $rina @{ jadwal_kerja = @{ jam_masuk = $jk.jam_masuk; jam_pulang = $jk.jam_pulang; toleransi_menit = [int]$jk.toleransi_menit } }
Cek "PUT jadwal_kerja (nilai sama) -> 200, jadwal tidak berubah" ($r2.status -eq 200 -and $r2.json.data.jadwal_kerja.jam_masuk -eq $jk.jam_masuk -and $r2.json.data.jadwal_kerja.jam_pulang -eq $jk.jam_pulang) "status=$($r2.status) $($r2.raw)"
Cek "PUT jadwal_kerja jam salah -> 422" ((Panggil "PUT" "/pengaturan" $rina @{ jadwal_kerja = @{ jam_masuk = "25:99" } }).status -eq 422)
Cek "PUT jam_pulang sebelum jam_masuk -> 422" ((Panggil "PUT" "/pengaturan" $rina @{ jadwal_kerja = @{ jam_masuk = "10:00"; jam_pulang = "09:00" } }).status -eq 422)

Write-Host ""
$warna = if ($script:gagal -eq 0) { "Green" } else { "Red" }
Write-Host "HASIL: $($script:lulus) lulus, $($script:gagal) gagal" -ForegroundColor $warna
if ($script:gagal -gt 0) { Write-Host "Kirim ke saya baris yang GAGAL beserta infonya." }
Write-Host ""
Write-Host "Data uji tersisa (absensi 2024, pengajuan Budi). Bersihkan lewat SQL bila perlu:"
Write-Host "  DELETE FROM absensi WHERE sumber IN ('koreksi','sistem') AND (tanggal < '2025-01-01' OR tanggal >= '2027-01-01');"
Write-Host "  DELETE FROM pengajuan_izin WHERE tanggal_mulai < '2025-01-01' OR tanggal_mulai >= '2027-01-01';"