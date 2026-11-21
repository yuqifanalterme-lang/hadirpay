# Tes otomatis tahap 2: karyawan, departemen, jabatan, komponen gaji, dan pengaturan sesuai kontrak.
# Syarat: php spark serve sedang jalan di terminal lain (restart dulu setelah setup).
#   powershell -ExecutionPolicy Bypass -File .\tes_kontrak_2.ps1
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
Write-Host "  4 akun berhasil login"
$acak = Get-Random -Minimum 10000 -Maximum 99999

Write-Host "== A. Departemen ==" -ForegroundColor Cyan
$r = Panggil "GET" "/departemen?per_page=100" $rina
$depts = @($r.json.data)
Cek "Daftar departemen -> 200, ada jumlah_karyawan (angka)" ($r.status -eq 200 -and $depts.Count -ge 1 -and (Angka $depts[0].jumlah_karyawan)) "status=$($r.status)"
$dipakai = $depts | Where-Object { $_.jumlah_karyawan -ge 1 } | Select-Object -First 1
Cek "Ada departemen dengan jumlah_karyawan >= 1" ($null -ne $dipakai)
$kata = $depts[0].nama.Substring(0, 3)
$r = Panggil "GET" "/departemen?search=$kata" $rina
Cek "Parameter search bekerja" ($r.status -eq 200 -and @($r.json.data).Count -ge 1) "status=$($r.status)"
$r = Panggil "POST" "/departemen" $rina @{ nama = "Tes Dept $acak" }
Cek "Buat departemen -> 201, jumlah_karyawan 0" ($r.status -eq 201 -and $r.json.data.jumlah_karyawan -eq 0) "status=$($r.status) $($r.raw)"
$deptBaru = $r.json.data.id
Cek "Hapus departemen kosong -> 200" ((Panggil "DELETE" "/departemen/$deptBaru" $rina).status -eq 200)
$r = Panggil "DELETE" "/departemen/$($dipakai.id)" $rina
Cek "Hapus departemen yang dipakai -> 409 CONFLICT" ($r.status -eq 409 -and $r.json.code -eq "CONFLICT") "status=$($r.status) code=$($r.json.code)"
Cek "Keuangan baca departemen -> 200" ((Panggil "GET" "/departemen" $andi).status -eq 200)
Cek "Pemilik baca departemen -> 200" ((Panggil "GET" "/departemen" $pemilik).status -eq 200)
Cek "Karyawan baca departemen -> 403" ((Panggil "GET" "/departemen" $budi).status -eq 403)
Cek "Keuangan tambah departemen -> 403" ((Panggil "POST" "/departemen" $andi @{ nama = "X$acak" }).status -eq 403)

Write-Host "== B. Jabatan ==" -ForegroundColor Cyan
$r = Panggil "GET" "/jabatan?per_page=100" $rina
$jabs = @($r.json.data)
Cek "Daftar jabatan -> 200, ada jumlah_karyawan (angka)" ($r.status -eq 200 -and $jabs.Count -ge 1 -and (Angka $jabs[0].jumlah_karyawan)) "status=$($r.status)"
$jabDipakai = $jabs | Where-Object { $_.jumlah_karyawan -ge 1 } | Select-Object -First 1
$r = Panggil "POST" "/jabatan" $rina @{ nama = "Tes Jabatan $acak" }
Cek "Buat jabatan -> 201, jumlah_karyawan 0" ($r.status -eq 201 -and $r.json.data.jumlah_karyawan -eq 0) "status=$($r.status) $($r.raw)"
$jabBaru = $r.json.data.id
Cek "Hapus jabatan kosong -> 200" ((Panggil "DELETE" "/jabatan/$jabBaru" $rina).status -eq 200)
$r = Panggil "DELETE" "/jabatan/$($jabDipakai.id)" $rina
Cek "Hapus jabatan yang dipakai -> 409 CONFLICT" ($r.status -eq 409 -and $r.json.code -eq "CONFLICT") "status=$($r.status) code=$($r.json.code)"
Cek "Karyawan baca jabatan -> 403" ((Panggil "GET" "/jabatan" $budi).status -eq 403)

Write-Host "== C. Karyawan: baca ==" -ForegroundColor Cyan
$r = Panggil "GET" "/karyawan?per_page=5" $rina
$k1 = @($r.json.data)[0]
Cek "Daftar -> 200, bentuk bersarang (jabatan.nama, departemen.nama, inisial)" ($r.status -eq 200 -and $k1.jabatan.nama -and $k1.departemen.nama -and $k1.inisial -and $k1.kode) "status=$($r.status)"
Cek "ID karyawan berupa angka" (Angka $k1.id)
$r = Panggil "GET" "/karyawan?search=Budi" $rina
Cek "Parameter search -> menemukan Budi" (@(@($r.json.data) | Where-Object { $_.nama -like "*Budi*" }).Count -ge 1) "status=$($r.status) total=$($r.json.meta.total)"
$r = Panggil "GET" "/karyawan?sort=nama&order=desc&per_page=5" $rina
$n = @($r.json.data)
Cek "sort=nama&order=desc -> urut menurun" ($n.Count -ge 2 -and [string]::Compare($n[0].nama, $n[$n.Count - 1].nama, $true) -ge 0) "pertama=$($n[0].nama) terakhir=$($n[$n.Count-1].nama)"
$r = Panggil "GET" "/karyawan?jenis_penggajian=bulanan&per_page=20" $rina
Cek "Filter jenis_penggajian=bulanan" ($r.status -eq 200 -and -not (@($r.json.data) | Where-Object { $_.jenis_penggajian -ne "bulanan" }))
$r = Panggil "GET" "/karyawan/$budiKid" $rina
$d = $r.json.data
Cek "Detail -> 200, gaji_pokok dan tunjangan_tetap berupa angka" ($r.status -eq 200 -and (Angka $d.gaji_pokok) -and (Angka $d.tunjangan_tetap)) "gaji_pokok=$($d.gaji_pokok) tipe=$(if ($null -ne $d.gaji_pokok) { $d.gaji_pokok.GetType().Name })"
Cek "Detail ada email, role=karyawan, komponen_gaji, sisa_cuti" ($d.email -and $d.role -eq "karyawan" -and ($d.PSObject.Properties.Name -contains "komponen_gaji") -and $null -ne $d.sisa_cuti) "role=$($d.role) sisa_cuti=$($d.sisa_cuti)"
Cek "Karyawan baca detail orang lain -> 403" ((Panggil "GET" "/karyawan/$budiKid" $budi).status -eq 403)

Write-Host "== D. Karyawan: tulis ==" -ForegroundColor Cyan
$emailBaru = "tes.$acak@hadirpay.test"
$r = Panggil "POST" "/karyawan" $rina @{}
Cek "Buat tanpa data -> 422, errors.nama berupa array" ($r.status -eq 422 -and $r.json.errors.nama -is [array]) "status=$($r.status)"
$badan = @{ nama = "Tes Karyawan $acak"; email = $emailBaru; no_hp = "081200000000"; departemen_id = $d.departemen_id; jabatan_id = $d.jabatan_id; tanggal_mulai = "2024-01-15"; jenis_penggajian = "bulanan"; gaji_pokok = 4500000; tunjangan_tetap = 300000; role = "karyawan"; password = "Password123!" }
$r = Panggil "POST" "/karyawan" $rina $badan
Cek "Buat karyawan -> 201, kode KRY-, role karyawan, gaji angka" ($r.status -eq 201 -and $r.json.data.kode -like "KRY-*" -and $r.json.data.role -eq "karyawan" -and (Angka $r.json.data.gaji_pokok)) "status=$($r.status) $($r.raw)"
$baruId = $r.json.data.id
Cek "Email dobel -> 422, errors.email berupa array" ((Panggil "POST" "/karyawan" $rina $badan).json.errors.email -is [array])
Cek "Keuangan tambah karyawan -> 403" ((Panggil "POST" "/karyawan" $andi $badan).status -eq 403)

$r = Panggil "PUT" "/karyawan/$baruId" $rina @{ no_hp = "081299999999" }
Cek "PUT sebagian (hanya no_hp) -> 200, nama tidak berubah" ($r.status -eq 200 -and $r.json.data.no_hp -eq "081299999999" -and $r.json.data.nama -eq "Tes Karyawan $acak") "status=$($r.status) $($r.raw)"
$r = Panggil "PUT" "/karyawan/$baruId" $rina @{ gaji_pokok = 5000000 }
Cek "PUT gaji_pokok -> 200, nilai 5000000" ($r.status -eq 200 -and [double]$r.json.data.gaji_pokok -eq 5000000)

$r = Panggil "GET" "/karyawan/$baruId/kehadiran-ringkas?periode=2026-11" $rina
Cek "Kehadiran ringkas -> 200 (hari_kerja, hadir, terlambat, izin, sakit, cuti, alpha)" ($r.status -eq 200 -and $r.json.data.periode -eq "2026-11" -and (Angka $r.json.data.hari_kerja) -and $null -ne $r.json.data.alpha -and $null -ne $r.json.data.hadir) "status=$($r.status) $($r.raw)"
Cek "Kehadiran ringkas: pemilik -> 200" ((Panggil "GET" "/karyawan/$baruId/kehadiran-ringkas?periode=2026-11" $pemilik).status -eq 200)
Cek "Kehadiran ringkas: keuangan -> 403" ((Panggil "GET" "/karyawan/$baruId/kehadiran-ringkas?periode=2026-11" $andi).status -eq 403)
Cek "Kehadiran ringkas: periode salah -> 422" ((Panggil "GET" "/karyawan/$baruId/kehadiran-ringkas?periode=abc" $rina).status -eq 422)

Cek "Status tidak valid -> 422" ((Panggil "PATCH" "/karyawan/$baruId/status" $rina @{ status = "ngawur" }).status -eq 422)
Cek "Keuangan ubah status -> 403" ((Panggil "PATCH" "/karyawan/$baruId/status" $andi @{ status = "nonaktif" }).status -eq 403)
$r = Panggil "PATCH" "/karyawan/$baruId/status" $rina @{ status = "nonaktif" }
Cek "PATCH status nonaktif -> 200" ($r.status -eq 200 -and $r.json.data.status -eq "nonaktif") "status=$($r.status) $($r.raw)"
$r = Panggil "POST" "/auth/login" $null @{ email = $emailBaru; password = "Password123!" }
Cek "Akun nonaktif tidak bisa login" ($r.status -ne 200) "status=$($r.status)"
$r = Panggil "PATCH" "/karyawan/$baruId/status" $rina @{ status = "aktif" }
Cek "PATCH status aktif lagi -> 200" ($r.status -eq 200 -and $r.json.data.status -eq "aktif")
$r = Panggil "DELETE" "/karyawan/$baruId" $rina
Cek "DELETE karyawan sudah tidak ada (bukan 200)" ($r.status -ne 200) "status=$($r.status)"
$r = Panggil "PATCH" "/karyawan/$baruId/status" $rina @{ status = "nonaktif" }

Write-Host "== E. Komponen gaji ==" -ForegroundColor Cyan
$r = Panggil "GET" "/komponen-gaji?search=alpha" $andi
Cek "Parameter search komponen -> menemukan alpha" ($r.status -eq 200 -and @($r.json.data).Count -ge 1) "status=$($r.status)"
$r = Panggil "POST" "/komponen-gaji" $rina @{ kode = "TES-$acak"; nama = "Tes Komponen $acak"; tipe = "pendapatan"; metode = "nominal_tetap"; nilai = 1000 }
Cek "Buat komponen -> 201" ($r.status -eq 201) "status=$($r.status) $($r.raw)"
$kompId = $r.json.data.id
$r = Panggil "PATCH" "/komponen-gaji/$kompId/status" $rina @{ aktif = $false }
Cek "PATCH status aktif=false -> 200, aktif false" ($r.status -eq 200 -and $r.json.data.aktif -eq $false) "status=$($r.status) $($r.raw)"
$r = Panggil "PATCH" "/komponen-gaji/$kompId/status" $rina @{ aktif = $true }
Cek "PATCH status aktif=true -> 200, aktif true" ($r.status -eq 200 -and $r.json.data.aktif -eq $true)
Cek "PATCH status tanpa aktif -> 422" ((Panggil "PATCH" "/komponen-gaji/$kompId/status" $rina @{}).status -eq 422)
Cek "PATCH status aktif tidak valid -> 422" ((Panggil "PATCH" "/komponen-gaji/$kompId/status" $rina @{ aktif = "abc" }).status -eq 422)
Cek "Keuangan ubah status komponen -> 403" ((Panggil "PATCH" "/komponen-gaji/$kompId/status" $andi @{ aktif = $false }).status -eq 403)
Cek "Hapus komponen uji -> 200" ((Panggil "DELETE" "/komponen-gaji/$kompId" $rina).status -eq 200)

Write-Host "== F. Pengaturan ==" -ForegroundColor Cyan
$r = Panggil "GET" "/pengaturan" $rina
$keys = if ($r.json.data) { @($r.json.data.PSObject.Properties.Name) } else { @() }
Write-Host ("  Key yang ada: " + ($keys -join ", ")) -ForegroundColor DarkGray
Cek "GET pengaturan -> 200" ($r.status -eq 200) "status=$($r.status)"
foreach ($kk in "perusahaan", "jadwal_kerja", "kebijakan_gaji", "kuota_cuti_tahunan") {
    Cek "Ada key $kk" ($keys -contains $kk) "key ada: $($keys -join ',')"
}
Cek "lokasi_absensi berupa array berisi lokasi (latitude angka)" ($keys -contains "lokasi_absensi" -and @($r.json.data.lokasi_absensi).Count -ge 1 -and (Angka @($r.json.data.lokasi_absensi)[0].latitude))
Cek "Keuangan baca pengaturan -> 200" ((Panggil "GET" "/pengaturan" $andi).status -eq 200)
Cek "Pemilik baca pengaturan -> 200" ((Panggil "GET" "/pengaturan" $pemilik).status -eq 200)
Cek "Karyawan baca pengaturan -> 403" ((Panggil "GET" "/pengaturan" $budi).status -eq 403)
Cek "Keuangan ubah pengaturan -> 403" ((Panggil "PUT" "/pengaturan" $andi @{ tes_kontrak = @{ nilai = 1 } }).status -eq 403)
$r = Panggil "PUT" "/pengaturan" $rina @{ tes_kontrak = @{ nilai = 1 }; lokasi_absensi = @() }
Cek "PUT sebagian tanpa pembungkus -> 200 (lokasi_absensi diabaikan)" ($r.status -eq 200 -and $r.json.data.tes_kontrak.nilai -eq 1) "status=$($r.status) $($r.raw)"
$r = Panggil "PUT" "/pengaturan" $rina @{ pengaturan = @{ tes_kontrak = @{ nilai = 2 } } }
Cek "Format lama dengan pembungkus tetap diterima" ($r.status -eq 200 -and $r.json.data.tes_kontrak.nilai -eq 2)
Cek "Hapus key uji -> 200" ((Panggil "DELETE" "/pengaturan/tes_kontrak" $rina).status -eq 200)

Write-Host ""
$warna = if ($script:gagal -eq 0) { "Green" } else { "Red" }
Write-Host "HASIL: $($script:lulus) lulus, $($script:gagal) gagal" -ForegroundColor $warna
if ($script:gagal -gt 0) { Write-Host "Kirim ke saya baris yang GAGAL beserta infonya (dan baris 'Key yang ada')." }
Write-Host ""
Write-Host "Data uji tersisa (karyawan tes.*, nonaktif). Bersihkan lewat SQL bila perlu:"
Write-Host "  DELETE FROM kuota_cuti WHERE karyawan_id IN (SELECT id FROM karyawan WHERE email LIKE 'tes.%@hadirpay.test');"
Write-Host "  DELETE FROM users WHERE email LIKE 'tes.%@hadirpay.test';"
Write-Host "  DELETE FROM karyawan WHERE email LIKE 'tes.%@hadirpay.test';"
