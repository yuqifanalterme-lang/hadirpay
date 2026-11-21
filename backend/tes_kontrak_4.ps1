# Tes otomatis tahap 4: dashboard (4 peran) dan pengguna.
#   powershell -ExecutionPolicy Bypass -File .\tes_kontrak_4.ps1
param([string]$ApiUrl = "http://localhost:8080/api/v1")

$script:lulus = 0
$script:gagal = 0

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
function Punya($obj, $nama) { return ($null -ne $obj -and ($obj.PSObject.Properties.Name -contains $nama)) }
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
$rinaId  = [int](Panggil "GET" "/auth/me" $rina).json.data.id
Write-Host "  4 akun berhasil login"
$acak = Get-Random -Minimum 10000 -Maximum 99999

Write-Host "== A. Dashboard admin ==" -ForegroundColor Cyan
$r = Panggil "GET" "/dashboard/admin" $rina
$d = $r.json.data
Cek "GET /dashboard/admin -> 200" ($r.status -eq 200) "status=$($r.status) $($r.raw)"
Cek "sapaan_rekap: persen_terisi, pengajuan_menunggu angka; periode_ditutup tanggal" ((Angka $d.sapaan_rekap.persen_terisi) -and (Angka $d.sapaan_rekap.pengajuan_menunggu) -and $d.sapaan_rekap.periode_ditutup -match '^\d{4}-\d{2}-\d{2}$') "sapaan=$($d.sapaan_rekap | ConvertTo-Json -Compress)"
Cek "statistik: total_karyawan >= 1, hadir, terlambat, tidak_hadir.total angka" ($d.statistik.total_karyawan -ge 1 -and (Angka $d.statistik.hadir_hari_ini) -and (Angka $d.statistik.terlambat) -and (Angka $d.statistik.tidak_hadir.total)) "statistik=$($d.statistik | ConvertTo-Json -Compress)"
Cek "statistik: batas_terlambat HH:mm, periode_gaji YYYY-MM, total_gaji angka" ($d.statistik.batas_terlambat -match '^\d{2}:\d{2}$' -and $d.statistik.periode_gaji -match '^\d{4}-\d{2}$' -and (Angka $d.statistik.total_gaji_bulan_berjalan))
Cek "kehadiran_minggu_ini: 5 hari, status valid, ada rata_rata_minggu_lalu" (@($d.kehadiran_minggu_ini.hari).Count -eq 5 -and -not (@($d.kehadiran_minggu_ini.hari) | Where-Object { @("selesai", "hari_ini", "akan_datang") -notcontains $_.status }) -and (Angka $d.kehadiran_minggu_ini.rata_rata_minggu_lalu))
Cek "ada tren_kehadiran, pengajuan_menunggu, absensi_terbaru (array)" ((Punya $d "tren_kehadiran") -and (Punya $d "pengajuan_menunggu") -and (Punya $d "absensi_terbaru"))
$r = Panggil "GET" "/dashboard/admin?tanggal=2020-01-06" $rina
Cek "Dengan tanggal lain -> 200, tanggal sesuai, hadir 0" ($r.status -eq 200 -and $r.json.data.tanggal -eq "2020-01-06" -and $r.json.data.statistik.hadir_hari_ini -eq 0) "status=$($r.status)"
Cek "Tanggal salah -> 422" ((Panggil "GET" "/dashboard/admin?tanggal=abc" $rina).status -eq 422)
Cek "Keuangan buka dashboard admin -> 403" ((Panggil "GET" "/dashboard/admin" $andi).status -eq 403)
Cek "Pemilik buka dashboard admin -> 403" ((Panggil "GET" "/dashboard/admin" $pemilik).status -eq 403)
Cek "Karyawan buka dashboard admin -> 403" ((Panggil "GET" "/dashboard/admin" $budi).status -eq 403)

Write-Host "== B. Dashboard karyawan ==" -ForegroundColor Cyan
$r = Panggil "GET" "/dashboard/karyawan" $budi
$d = $r.json.data
Cek "GET /dashboard/karyawan (Budi) -> 200" ($r.status -eq 200) "status=$($r.status) $($r.raw)"
Cek "server_time ISO +07:00, jam_kerja HH:mm" ($d.server_time -match '\+07:00$' -and $d.jam_kerja.masuk -match '^\d{2}:\d{2}$' -and $d.jam_kerja.pulang -match '^\d{2}:\d{2}$') "server_time=$($d.server_time)"
Cek "absensi_hari_ini: sudah_masuk dan sudah_pulang boolean" ($d.absensi_hari_ini.sudah_masuk -is [bool] -and $d.absensi_hari_ini.sudah_pulang -is [bool])
Cek "kehadiran_minggu_ini: total_hari 5, 5 hari" ($d.kehadiran_minggu_ini.total_hari -eq 5 -and @($d.kehadiran_minggu_ini.hari).Count -eq 5 -and (Angka $d.kehadiran_minggu_ini.tercatat))
Cek "ada lokasi_kantor, slip_terakhir, pengajuan_terakhir, jumlah_notifikasi" ((Punya $d "lokasi_kantor") -and (Punya $d "slip_terakhir") -and (Punya $d "pengajuan_terakhir") -and (Angka $d.jumlah_notifikasi))
$r = Panggil "GET" "/dashboard/karyawan" $andi
Cek "Keuangan (juga karyawan) -> 200" ($r.status -eq 200) "status=$($r.status)"
if ($r.json.data.slip_terakhir) {
    Cek "slip_terakhir Andi: periode, gaji_bersih angka" ($r.json.data.slip_terakhir.periode -match '^\d{4}-\d{2}$' -and (Angka $r.json.data.slip_terakhir.gaji_bersih)) "slip=$($r.json.data.slip_terakhir | ConvertTo-Json -Compress)"
}
Cek "Admin HRD buka dashboard karyawan -> 403" ((Panggil "GET" "/dashboard/karyawan" $rina).status -eq 403)
Cek "Pemilik buka dashboard karyawan -> 403" ((Panggil "GET" "/dashboard/karyawan" $pemilik).status -eq 403)

Write-Host "== C. Dashboard keuangan ==" -ForegroundColor Cyan
$r = Panggil "GET" "/dashboard/keuangan" $andi
$d = $r.json.data
Cek "GET /dashboard/keuangan -> 200" ($r.status -eq 200) "status=$($r.status) $($r.raw)"
Cek "periode_menunggu_validasi array, saldo_utang_gaji dan total_beban angka" ((Punya $d "periode_menunggu_validasi") -and (Angka $d.saldo_utang_gaji) -and (Angka $d.total_beban_gaji_bulan_berjalan)) "d=$($d | ConvertTo-Json -Compress -Depth 4)"
Cek "ada jadwal_pembayaran (boleh null)" (Punya $d "jadwal_pembayaran")
Cek "Admin HRD buka dashboard keuangan -> 403" ((Panggil "GET" "/dashboard/keuangan" $rina).status -eq 403)
Cek "Karyawan buka dashboard keuangan -> 403" ((Panggil "GET" "/dashboard/keuangan" $budi).status -eq 403)

Write-Host "== D. Dashboard pemilik ==" -ForegroundColor Cyan
$r = Panggil "GET" "/dashboard/pemilik" $pemilik
$d = $r.json.data
Cek "GET /dashboard/pemilik -> 200" ($r.status -eq 200) "status=$($r.status) $($r.raw)"
Cek "total_biaya_gaji_bulan_berjalan angka, ada tren_beban_gaji" ((Angka $d.total_biaya_gaji_bulan_berjalan) -and (Punya $d "tren_beban_gaji"))
Cek "kehadiran_per_departemen: departemen dan persen_hadir angka" (@($d.kehadiran_per_departemen).Count -ge 1 -and -not (@($d.kehadiran_per_departemen) | Where-Object { -not (Angka $_.persen_hadir) -or -not $_.departemen })) "isi=$($d.kehadiran_per_departemen | ConvertTo-Json -Compress)"
Cek "ada top_keterlambatan (array)" (Punya $d "top_keterlambatan")
Cek "Admin HRD buka dashboard pemilik -> 403" ((Panggil "GET" "/dashboard/pemilik" $rina).status -eq 403)
Cek "Keuangan buka dashboard pemilik -> 403" ((Panggil "GET" "/dashboard/pemilik" $andi).status -eq 403)

Write-Host "== E. Pengguna ==" -ForegroundColor Cyan
$r = Panggil "GET" "/pengguna?per_page=100" $rina
$u1 = @($r.json.data)[0]
Cek "GET /pengguna -> 200, ada id, email, role, aktif (boolean)" ($r.status -eq 200 -and (Angka $u1.id) -and $u1.email -and $u1.role -and $u1.aktif -is [bool]) "status=$($r.status)"
$r = Panggil "GET" "/pengguna?search=budi" $rina
Cek "Parameter search -> menemukan Budi" (@(@($r.json.data) | Where-Object { $_.email -like "budi@*" }).Count -ge 1) "status=$($r.status) total=$($r.json.meta.total)"
$r = Panggil "GET" "/pengguna?role=pemilik" $rina
Cek "Filter role=pemilik" ($r.status -eq 200 -and @($r.json.data).Count -ge 1 -and -not (@($r.json.data) | Where-Object { $_.role -ne "pemilik" }))
Cek "Keuangan buka /pengguna -> 403" ((Panggil "GET" "/pengguna" $andi).status -eq 403)
Cek "Karyawan buka /pengguna -> 403" ((Panggil "GET" "/pengguna" $budi).status -eq 403)

# akun uji lewat POST /karyawan
$budiKid = [int](Panggil "GET" "/auth/me" $budi).json.data.karyawan_id
$bd = (Panggil "GET" "/karyawan/$budiKid" $rina).json.data
$emailUji = "tes.$acak@hadirpay.test"
$r = Panggil "POST" "/karyawan" $rina @{ nama = "Tes Pengguna $acak"; email = $emailUji; departemen_id = $bd.departemen_id; jabatan_id = $bd.jabatan_id; tanggal_mulai = "2024-01-15"; gaji_pokok = 4500000; role = "karyawan"; password = "Password123!" }
Cek "Buat akun uji (POST /karyawan) -> 201" ($r.status -eq 201) "status=$($r.status) $($r.raw)"
$uid = @((Panggil "GET" "/pengguna?search=$emailUji" $rina).json.data)[0].id

$r = Panggil "PUT" "/pengguna/$uid/role" $rina @{ role = "keuangan" }
Cek "PUT role -> 200, role keuangan" ($r.status -eq 200 -and $r.json.data.role -eq "keuangan") "status=$($r.status) $($r.raw)"
Cek "PUT role tidak valid -> 422" ((Panggil "PUT" "/pengguna/$uid/role" $rina @{ role = "ngawur" }).status -eq 422)
Cek "Keuangan ubah role -> 403" ((Panggil "PUT" "/pengguna/$uid/role" $andi @{ role = "karyawan" }).status -eq 403)
Cek "Ubah role akun sendiri -> 409" ((Panggil "PUT" "/pengguna/$rinaId/role" $rina @{ role = "karyawan" }).status -eq 409)
Cek "Pengguna tidak ada -> 404" ((Panggil "PUT" "/pengguna/99999999/role" $rina @{ role = "karyawan" }).status -eq 404)

Cek "PATCH status tanpa aktif -> 422" ((Panggil "PATCH" "/pengguna/$uid/status" $rina @{}).status -eq 422)
$r = Panggil "PATCH" "/pengguna/$uid/status" $rina @{ aktif = $false }
Cek "PATCH status aktif=false -> 200, aktif false" ($r.status -eq 200 -and $r.json.data.aktif -eq $false) "status=$($r.status) $($r.raw)"
Cek "Akun nonaktif tidak bisa login" ((Panggil "POST" "/auth/login" $null @{ email = $emailUji; password = "Password123!" }).status -ne 200)
$r = Panggil "PATCH" "/pengguna/$uid/status" $rina @{ aktif = $true }
Cek "PATCH status aktif=true -> 200" ($r.status -eq 200 -and $r.json.data.aktif -eq $true)
Cek "Nonaktifkan akun sendiri -> 409" ((Panggil "PATCH" "/pengguna/$rinaId/status" $rina @{ aktif = $false }).status -eq 409)

$r = Panggil "POST" "/pengguna/$uid/reset-password" $rina
$pwBaru = $r.json.data.password_sementara
Cek "Reset password -> 200, password_sementara minimal 8 karakter" ($r.status -eq 200 -and $pwBaru.Length -ge 8) "status=$($r.status) $($r.raw)"
Cek "Login dengan password sementara -> 200" ((Panggil "POST" "/auth/login" $null @{ email = $emailUji; password = $pwBaru }).status -eq 200)
Cek "Login dengan password lama -> bukan 200" ((Panggil "POST" "/auth/login" $null @{ email = $emailUji; password = "Password123!" }).status -ne 200)
Cek "Keuangan reset password -> 403" ((Panggil "POST" "/pengguna/$uid/reset-password" $andi).status -eq 403)

Write-Host ""
$warna = if ($script:gagal -eq 0) { "Green" } else { "Red" }
Write-Host "HASIL: $($script:lulus) lulus, $($script:gagal) gagal" -ForegroundColor $warna
if ($script:gagal -gt 0) { Write-Host "Kirim ke saya baris yang GAGAL beserta infonya." }
Write-Host ""
Write-Host "Data uji tersisa (akun tes.*). Bersihkan lewat SQL bila perlu:"
Write-Host "  DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'tes.%@hadirpay.test');"
Write-Host "  DELETE FROM kuota_cuti WHERE karyawan_id IN (SELECT id FROM karyawan WHERE email LIKE 'tes.%@hadirpay.test');"
Write-Host "  DELETE FROM users WHERE email LIKE 'tes.%@hadirpay.test';"
Write-Host "  DELETE FROM karyawan WHERE email LIKE 'tes.%@hadirpay.test';"