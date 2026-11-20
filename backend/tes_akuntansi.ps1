# Tes otomatis: akuntansi + alur payroll sesuai kontrak.
# Syarat: php spark serve sedang jalan di terminal lain.
#   powershell -ExecutionPolicy Bypass -File .\tes_akuntansi.ps1
param(
    [string]$Base = "http://localhost:8080/api/v1",
    [string]$Periode = (Get-Date).ToString("yyyy-MM")
)

$script:lulus = 0
$script:gagal = 0

function Panggil($metode, $path, $token, $body = $null) {
    $p = @{ Method = $metode; Uri = "$Base$path"; ContentType = "application/json"; UseBasicParsing = $true }
    if ($token) { $p.Headers = @{ Authorization = "Bearer $token" } }
    if ($null -ne $body) { $p.Body = ($body | ConvertTo-Json -Depth 8) }
    try {
        $r = Invoke-WebRequest @p
        return @{ status = [int]$r.StatusCode; json = ($r.Content | ConvertFrom-Json) }
    } catch {
        $status = 0; $json = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            try { $json = $_.ErrorDetails.Message | ConvertFrom-Json } catch { }
        }
        if (-not $json -and $_.Exception.Response) {
            try {
                $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $txt = $sr.ReadToEnd()
                if ($txt) { $json = $txt | ConvertFrom-Json }
            } catch { }
        }
        return @{ status = $status; json = $json }
    }
}

function Cek($nama, $kondisi, $info = "") {
    if ($kondisi) { $script:lulus++; Write-Host "  LULUS  $nama" -ForegroundColor Green }
    else { $script:gagal++; Write-Host "  GAGAL  $nama   $info" -ForegroundColor Red }
}

function Sama($a, $b) { return ([math]::Abs([double]$a - [double]$b) -lt 0.01) }

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

Write-Host "== A. Data akun ==" -ForegroundColor Cyan
$r = Panggil "GET" "/akun" $andi
Cek "Keuangan lihat akun -> 200 (minimal 5 akun)" ($r.status -eq 200 -and @($r.json.data).Count -ge 5) "status=$($r.status)"
$akun  = @($r.json.data)
$beban = $akun | Where-Object { $_.kode -eq "5-1100" } | Select-Object -First 1
$utang = $akun | Where-Object { $_.kode -eq "2-1100" } | Select-Object -First 1
$kas   = $akun | Where-Object { $_.kode -eq "1-1100" } | Select-Object -First 1
Cek "Akun Beban Gaji, Utang Gaji, Kas/Bank ada" ($beban -and $utang -and $kas)
Cek "Pemilik lihat akun -> 200"  ((Panggil "GET" "/akun" $pemilik).status -eq 200)
Cek "Admin HRD lihat akun -> 200" ((Panggil "GET" "/akun" $rina).status -eq 200)
Cek "Karyawan lihat akun -> 403" ((Panggil "GET" "/akun" $budi).status -eq 403)

$kode = "9-" + (Get-Random -Minimum 1000 -Maximum 9999)
$r = Panggil "POST" "/akun" $andi @{ kode = $kode; nama = "Akun Uji"; kategori = "beban" }
Cek "Tambah akun -> 201, saldo normal otomatis debit" ($r.status -eq 201 -and $r.json.data.saldo_normal -eq "debit") "status=$($r.status)"
$idUji = $r.json.data.id
Cek "Kode kembar -> 422" ((Panggil "POST" "/akun" $andi @{ kode = $kode; nama = "Dobel"; kategori = "beban" }).status -eq 422)
Cek "Admin HRD tambah akun -> 403" ((Panggil "POST" "/akun" $rina @{ kode = "9-0001"; nama = "X"; kategori = "beban" }).status -eq 403)
$r = Panggil "PUT" "/akun/$idUji" $andi @{ kode = $kode; nama = "Akun Uji Ubah"; kategori = "beban"; aktif = $true }
Cek "Ubah akun -> 200" ($r.status -eq 200 -and $r.json.data.nama -eq "Akun Uji Ubah") "status=$($r.status)"
Cek "Hapus akun sistem -> 409" ((Panggil "DELETE" "/akun/$($beban.id)" $andi).status -eq 409)
Cek "Hapus akun uji -> 200" ((Panggil "DELETE" "/akun/$idUji" $andi).status -eq 200)

Write-Host "== B. Jurnal manual ==" -ForegroundColor Cyan
$hariIni = (Get-Date).ToString("yyyy-MM-dd")
$r = Panggil "POST" "/jurnal" $andi @{ tanggal = $hariIni; keterangan = "Jurnal uji tidak seimbang"; detail = @( @{ akun_id = $beban.id; debit = 100000; kredit = 0 }, @{ akun_id = $utang.id; debit = 0; kredit = 90000 } ) }
Cek "Jurnal tidak seimbang -> 422 JOURNAL_NOT_BALANCED" ($r.status -eq 422 -and $r.json.code -eq "JOURNAL_NOT_BALANCED") "status=$($r.status) code=$($r.json.code)"
$r = Panggil "POST" "/jurnal" $andi @{ tanggal = $hariIni; keterangan = "Jurnal uji seimbang"; detail = @( @{ akun_id = $beban.id; debit = 100000; kredit = 0 }, @{ akun_id = $utang.id; debit = 0; kredit = 100000 } ) }
Cek "Jurnal seimbang -> 201, nomor bukti JU/..." ($r.status -eq 201 -and $r.json.data.nomor_bukti -like "JU/*") "status=$($r.status)"
$jm = $r.json.data.id
Cek "Detail jurnal berisi 2 baris" (@($r.json.data.detail).Count -eq 2)
Cek "Lihat jurnal manual -> 200" ((Panggil "GET" "/jurnal/$jm" $pemilik).status -eq 200)
$r = Panggil "PUT" "/jurnal/$jm" $andi @{ tanggal = $hariIni; keterangan = "Jurnal uji diubah"; detail = @( @{ akun_id = $beban.id; debit = 250000; kredit = 0 }, @{ akun_id = $utang.id; debit = 0; kredit = 250000 } ) }
Cek "Ubah jurnal manual -> 200, total 250000" ($r.status -eq 200 -and (Sama $r.json.data.total_debit 250000)) "status=$($r.status)"
Cek "Admin HRD buat jurnal -> 403"   ((Panggil "POST" "/jurnal" $rina @{ tanggal = $hariIni; keterangan = "x y z"; detail = @() }).status -eq 403)
Cek "Pemilik buat jurnal -> 403"      ((Panggil "POST" "/jurnal" $pemilik @{ tanggal = $hariIni; keterangan = "x y z"; detail = @() }).status -eq 403)
Cek "Karyawan lihat jurnal -> 403"    ((Panggil "GET" "/jurnal" $budi).status -eq 403)
Cek "Hapus jurnal manual -> 200"      ((Panggil "DELETE" "/jurnal/$jm" $andi).status -eq 200)

Write-Host "== C. Payroll sesuai kontrak ($Periode) ==" -ForegroundColor Cyan
$list = Panggil "GET" "/periode-gaji?per_page=100" $rina
$lama = @($list.json.data) | Where-Object { $_.periode -eq $Periode }
if ($lama) {
    if ($lama.status -eq "draft") { Panggil "DELETE" "/periode-gaji/$($lama.id)" $rina | Out-Null; Write-Host "  periode draft lama dihapus" }
    else { throw "Periode $Periode sudah berstatus $($lama.status). Reset lewat SQL atau jalankan dengan -Periode 2026-12" }
}

$r = Panggil "POST" "/periode-gaji" $rina @{ periode = $Periode }
Cek "Buat periode -> 201 draft" ($r.status -eq 201 -and $r.json.data.status -eq "draft") "status=$($r.status)"
$id = $r.json.data.id
Cek "Periode kembar -> 409" ((Panggil "POST" "/periode-gaji" $rina @{ periode = $Periode }).status -eq 409)
Cek "Keuangan buat periode -> 403" ((Panggil "POST" "/periode-gaji" $andi @{ periode = "2031-01" }).status -eq 403)

$r = Panggil "POST" "/periode-gaji/$id/hitung" $rina
Cek "Hitung gaji -> 200, ada periode_id" ($r.status -eq 200 -and $r.json.data.periode_id -eq $id) "status=$($r.status) $($r.json.message)"
Cek "Keuangan hitung gaji -> 403" ((Panggil "POST" "/periode-gaji/$id/hitung" $andi).status -eq 403)

$r = Panggil "GET" "/periode-gaji/$id/penggajian?per_page=100" $rina
$semua = @($r.json.data)
Cek "Daftar penggajian -> 200, ada karyawan bersarang" ($r.status -eq 200 -and $semua.Count -gt 0 -and $semua[0].karyawan.nama)
$budiRow = $semua | Where-Object { $_.karyawan.id -eq $budiKid } | Select-Object -First 1
$lainRow = $semua | Where-Object { $_.karyawan.id -ne $budiKid } | Select-Object -First 1
$d = Panggil "GET" "/penggajian/$($budiRow.id)" $budi
Cek "Karyawan buka rincian gaji sendiri -> 200 (ada rincian dan kehadiran)" ($d.status -eq 200 -and @($d.json.data.rincian).Count -gt 0 -and $null -ne $d.json.data.kehadiran) "status=$($d.status)"
Cek "Karyawan buka rincian gaji orang lain -> 403" ((Panggil "GET" "/penggajian/$($lainRow.id)" $budi).status -eq 403)

$r = Panggil "POST" "/periode-gaji/$id/ajukan-validasi" $rina
Cek "Ajukan validasi -> 200 menunggu_validasi" ($r.status -eq 200 -and $r.json.data.status -eq "menunggu_validasi") "status=$($r.status) $($r.json.message)"
Cek "Hitung saat menunggu validasi -> 409" ((Panggil "POST" "/periode-gaji/$id/hitung" $rina).status -eq 409)
Cek "Admin HRD setujui -> 403 (hanya keuangan)" ((Panggil "POST" "/periode-gaji/$id/setujui" $rina @{}).status -eq 403)
Cek "Kembalikan tanpa catatan -> 422" ((Panggil "POST" "/periode-gaji/$id/kembalikan" $andi @{}).status -eq 422)
$r = Panggil "POST" "/periode-gaji/$id/kembalikan" $andi @{ catatan = "Cek ulang lembur" }
Cek "Kembalikan dengan catatan -> 200 draft" ($r.status -eq 200 -and $r.json.data.status -eq "draft") "status=$($r.status)"
Cek "Ajukan lagi -> 200" ((Panggil "POST" "/periode-gaji/$id/ajukan-validasi" $rina).status -eq 200)

$r = Panggil "POST" "/periode-gaji/$id/setujui" $andi @{ catatan = "OK" }
Cek "Setujui -> 200 disetujui" ($r.status -eq 200 -and $r.json.data.status -eq "disetujui") "status=$($r.status) $($r.json.message)"
$p = $r.json.data
$totalBersih = [double]$p.ringkasan.total_gaji_bersih
Cek "Jurnal pengakuan terbentuk (ada id)" ($null -ne $p.jurnal_pengakuan_id) "id=$($p.jurnal_pengakuan_id)"
Cek "Setujui dua kali -> 409" ((Panggil "POST" "/periode-gaji/$id/setujui" $andi @{}).status -eq 409)

$j = Panggil "GET" "/jurnal/$($p.jurnal_pengakuan_id)" $andi
$jd = $j.json.data
Cek "Jurnal pengakuan: otomatis, jenis pengakuan_gaji, nomor JU/..." ($j.status -eq 200 -and $jd.sumber -eq "otomatis" -and $jd.jenis -eq "pengakuan_gaji" -and $jd.nomor_bukti -like "JU/*")
Cek "Jurnal pengakuan seimbang (debit = kredit)" (Sama $jd.total_debit $jd.total_kredit) "debit=$($jd.total_debit) kredit=$($jd.total_kredit)"
$utangJ = @($jd.detail) | Where-Object { $_.kode_akun -eq "2-1100" } | Select-Object -First 1
Cek "Kredit Utang Gaji = total gaji bersih periode" ($utangJ -and (Sama $utangJ.kredit $totalBersih)) "kredit=$($utangJ.kredit) bersih=$totalBersih"
Write-Host ("    pengakuan: {0} | debit {1:N0} | kredit Utang Gaji {2:N0}" -f $jd.nomor_bukti, [double]$jd.total_debit, [double]$utangJ.kredit)
Cek "Ubah jurnal otomatis -> 403"  ((Panggil "PUT" "/jurnal/$($p.jurnal_pengakuan_id)" $andi @{ tanggal = $hariIni; keterangan = "ubah"; detail = @() }).status -eq 403)
Cek "Hapus jurnal otomatis -> 403" ((Panggil "DELETE" "/jurnal/$($p.jurnal_pengakuan_id)" $andi).status -eq 403)

Write-Host "== D. Slip gaji ==" -ForegroundColor Cyan
$s = Panggil "GET" "/slip-gaji" $budi
$slips = @($s.json.data)
Cek "Slip Budi -> 200 dan hanya miliknya" ($s.status -eq 200 -and $slips.Count -ge 1 -and -not ($slips | Where-Object { $_.karyawan.id -ne $budiKid }))
if ($slips.Count -ge 1) {
    $slip = $slips | Where-Object { $_.periode -eq $Periode } | Select-Object -First 1
    Cek "Nomor slip berformat SLP/..." ($slip.nomor_slip -like "SLP/*") "nomor=$($slip.nomor_slip)"
    $x = Panggil "GET" "/slip-gaji/$($slip.id)" $budi
    Cek "Isi slip -> 200 (nomor_slip, rincian, perusahaan)" ($x.status -eq 200 -and $x.json.data.nomor_slip -and @($x.json.data.rincian).Count -gt 0 -and $x.json.data.perusahaan.nama)
    Cek "Pemilik buka slip Budi -> 200" ((Panggil "GET" "/slip-gaji/$($slip.id)" $pemilik).status -eq 200)
    $semuaSlip = @((Panggil "GET" "/slip-gaji?per_page=100&periode=$Periode" $rina).json.data)
    Cek "Admin HRD melihat slip semua karyawan" ($semuaSlip.Count -gt 1)
    $lain = $semuaSlip | Where-Object { $_.karyawan.id -ne $budiKid } | Select-Object -First 1
    Cek "Budi buka slip orang lain -> 403" ((Panggil "GET" "/slip-gaji/$($lain.id)" $budi).status -eq 403)
}

Write-Host "== E. Pembayaran ==" -ForegroundColor Cyan
Cek "Karyawan bayar -> 403" ((Panggil "POST" "/periode-gaji/$id/bayar" $budi @{}).status -eq 403)
Cek "Akun kas bukan aset -> 422" ((Panggil "POST" "/periode-gaji/$id/bayar" $andi @{ akun_kas_id = $beban.id }).status -eq 422)
$r = Panggil "POST" "/periode-gaji/$id/bayar" $andi @{ akun_kas_id = $kas.id; catatan = "Transfer uji" }
Cek "Bayar -> 200 dibayar" ($r.status -eq 200 -and $r.json.data.status -eq "dibayar") "status=$($r.status) $($r.json.message)"
$p2 = $r.json.data
Cek "Jurnal pembayaran terbentuk (ada id)" ($null -ne $p2.jurnal_pembayaran_id)
Cek "Bayar dua kali -> 409" ((Panggil "POST" "/periode-gaji/$id/bayar" $andi @{}).status -eq 409)
Cek "Hapus periode yang sudah dibayar -> 409" ((Panggil "DELETE" "/periode-gaji/$id" $rina).status -eq 409)

$jb = (Panggil "GET" "/jurnal/$($p2.jurnal_pembayaran_id)" $andi).json.data
$utangDebit = @($jb.detail) | Where-Object { $_.kode_akun -eq "2-1100" } | Select-Object -First 1
$kasKredit  = @($jb.detail) | Where-Object { $_.kode_akun -eq "1-1100" } | Select-Object -First 1
Cek "Jurnal pembayaran: debit Utang Gaji = total gaji bersih" ($utangDebit -and (Sama $utangDebit.debit $totalBersih)) "debit=$($utangDebit.debit)"
Cek "Jurnal pembayaran: kredit Kas/Bank = total gaji bersih" ($kasKredit -and (Sama $kasKredit.kredit $totalBersih))
Cek "Riwayat status berisi 6 catatan" (@((Panggil "GET" "/periode-gaji/$id" $rina).json.data.riwayat_status).Count -eq 6)

Write-Host "== F. Buku besar dan neraca saldo ==" -ForegroundColor Cyan
$bb = Panggil "GET" "/buku-besar?akun_id=$($utang.id)" $andi
Cek "Buku besar Utang Gaji -> 200" ($bb.status -eq 200 -and $bb.json.data.akun.kode -eq "2-1100") "status=$($bb.status)"
$mut = @($bb.json.data.mutasi)
$m1 = $mut | Where-Object { $_.jurnal_id -eq $p.jurnal_pengakuan_id } | Select-Object -First 1
$m2 = $mut | Where-Object { $_.jurnal_id -eq $p2.jurnal_pembayaran_id } | Select-Object -First 1
Cek "Mutasi pengakuan: kredit = total gaji bersih" ($m1 -and (Sama $m1.kredit $totalBersih))
Cek "Mutasi pembayaran: debit = total gaji bersih" ($m2 -and (Sama $m2.debit $totalBersih))
Cek "Saldo akhir Utang Gaji tidak minus" ([double]$bb.json.data.saldo_akhir -ge -0.01) "saldo=$($bb.json.data.saldo_akhir)"
Cek "Buku besar tanpa akun_id -> 422" ((Panggil "GET" "/buku-besar" $andi).status -eq 422)
$ns = Panggil "GET" "/neraca-saldo" $andi
Cek "Neraca saldo -> 200 dan seimbang" ($ns.status -eq 200 -and $ns.json.data.seimbang -eq $true) "debit=$($ns.json.data.total_debit) kredit=$($ns.json.data.total_kredit)"
Write-Host ("    neraca saldo: debit {0:N0} | kredit {1:N0}" -f [double]$ns.json.data.total_debit, [double]$ns.json.data.total_kredit)
Cek "Pemilik buka buku besar -> 200" ((Panggil "GET" "/buku-besar?akun_id=$($utang.id)" $pemilik).status -eq 200)
Cek "Karyawan buka neraca saldo -> 403" ((Panggil "GET" "/neraca-saldo" $budi).status -eq 403)

Write-Host ""
$warna = if ($script:gagal -eq 0) { "Green" } else { "Red" }
Write-Host "HASIL: $($script:lulus) lulus, $($script:gagal) gagal" -ForegroundColor $warna
if ($script:gagal -gt 0) { Write-Host "Kirim ke saya baris yang GAGAL beserta angka-angkanya." }