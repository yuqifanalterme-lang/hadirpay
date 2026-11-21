# Menjalankan semua tes berurutan, merangkum hasil, dan menyimpan log lengkap ke hasil_tes.txt
#   powershell -ExecutionPolicy Bypass -File .\jalankan_semua_tes.ps1
# Opsi: -TanpaTesLama (lewati tes_akuntansi), -Periode 2045-03 (periode sekali pakai untuk tes_akuntansi)
param([string]$Periode = "", [switch]$TanpaTesLama)

if (-not $Periode) { $Periode = "{0}-{1:00}" -f (Get-Random -Minimum 2040 -Maximum 2095), (Get-Random -Minimum 1 -Maximum 13) }

$daftar = @(
    @{ nama = "Tahap 1 (format, pengajuan, notifikasi)"; file = "tes_kontrak_1.ps1"; arg = @() },
    @{ nama = "Tahap 2 (karyawan, master, pengaturan)";  file = "tes_kontrak_2.ps1"; arg = @() },
    @{ nama = "Tahap 3 (absensi admin, rekap)";          file = "tes_kontrak_3.ps1"; arg = @() }
)
if (-not $TanpaTesLama -and (Test-Path .\tes_akuntansi.ps1)) {
    $daftar += @{ nama = "Akuntansi (tes lama, periode $Periode)"; file = "tes_akuntansi.ps1"; arg = @("-Periode", $Periode) }
}

$log     = New-Object System.Text.StringBuilder
$ringkas = @()
$adaGagal = $false

foreach ($t in $daftar) {
    Write-Host ""
    Write-Host ">>> $($t.nama)" -ForegroundColor Cyan
    if (-not (Test-Path ".\$($t.file)")) {
        Write-Host "    file $($t.file) tidak ada, dilewati" -ForegroundColor Yellow
        $ringkas += "{0,-45} dilewati" -f $t.nama
        continue
    }

    $argumen = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\$($t.file)") + $t.arg
    $teks    = (& powershell @argumen 2>&1 | Out-String)
    [void]$log.AppendLine("##### $($t.nama) #####")
    [void]$log.AppendLine($teks)

    foreach ($baris in ($teks -split "`r?`n")) {
        if ($baris -match "GAGAL|Key yang ada|ERROR|Exception") { Write-Host $baris -ForegroundColor Red }
    }

    $m = [regex]::Match($teks, "HASIL:\s*(\d+)\s+lulus,\s*(\d+)\s+gagal")
    if ($m.Success) {
        $g = [int]$m.Groups[2].Value
        if ($g -gt 0) { $adaGagal = $true }
        $warna = if ($g -eq 0) { "Green" } else { "Red" }
        Write-Host ("    {0} lulus, {1} gagal" -f $m.Groups[1].Value, $g) -ForegroundColor $warna
        $ringkas += "{0,-45} {1} lulus, {2} gagal" -f $t.nama, $m.Groups[1].Value, $g
    } else {
        $adaGagal = $true
        Write-Host "    tidak ada baris HASIL (tes berhenti di tengah?). 8 baris terakhir:" -ForegroundColor Yellow
        ($teks -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 8) | ForEach-Object { Write-Host "    $_" }
        $ringkas += "{0,-45} TIDAK ADA HASIL" -f $t.nama
    }
}

[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path "hasil_tes.txt"), $log.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "================ RINGKASAN ================" -ForegroundColor Cyan
$ringkas | ForEach-Object { Write-Host $_ }
Write-Host ""
if ($adaGagal) {
    Write-Host "Ada yang gagal. Kirim file hasil_tes.txt (atau baris merahnya) ke saya." -ForegroundColor Red
} else {
    Write-Host "Semua tes lulus. Aman untuk commit dan push." -ForegroundColor Green
}