# HADIRPAY API integration status

All `NEXT_PUBLIC_MOCK_*` switches were left unchanged. With mock switches enabled,
the existing demo data paths remain active; live paths are selected by each module's
service when its switch is disabled. A successful live round-trip has not been
verified because the checked-in backend does not register most of the contract routes.

Endpoint and payload names below follow the supplied API contract and the
contract-oriented service adapters. `BACKEND_HANDOFF.md` is an older proposal and is
not used as the source of truth.

## Module status

| Module | Status | Connected in screens | Still mock or partial |
| --- | --- | --- | --- |
| Auth | SELESAI | Login, refresh, logout, `/auth/me`, password change, and `menu_access` route guard use the auth service/provider. API messages are retained; empty messages for known auth/business error codes use friendly Indonesian fallbacks. A second 401 after refresh expires the session; invalid refresh tokens (401/403) expire it, while network/5xx refresh failures keep the session and show a retry toast. | Mock authentication remains selected by its switch; live login hides demo roles and prefilled credentials. |
| Karyawan + master | SEBAGIAN | List/query filters, detail, create/update, status changes, monthly attendance summary, and jabatan/departemen CRUD use the service adapters. Create sends the contract fields and leaves `kode` to the backend. | Employee payslip history stays mock; the backend still lacks `PATCH /karyawan/{id}/status` and `GET /karyawan/{id}/kehadiran-ringkas`. |
| Absensi | SELESAI | Employee check-in/out and history, admin daily list/export, and recap call the service. Admin list mapping preserves a null status and renders it as neutral “Belum absen”. Dashboard check-in/out use `/absensi/hari-ini` and the check-in/out services, using server time, server permissions, and office details. Export uses a blob; `dinas_luar` is represented explicitly. | Mock mode keeps the existing local clock and demo attendance behavior. Correction handling uses the Pengajuan service. |
| Pengajuan | SELESAI | Employee/admin lists call `/pengajuan` with UI filters, 300 ms debounced search, date range, and pagination; status summary cards use response `ringkasan`. The create adapter sends distinct contract bodies: izin/sakit/cuti include `tanggal_selesai` and optional `lampiran`; koreksi_absensi and lembur omit `tanggal_selesai` and send their respective time fields. Approval/rejection, bulk approval, cancellation, and quota use service adapters. API validation errors are shown on matching form fields. | Mock mode applies the same filters and pagination in the adapter. Bulk rejection is not exposed as a screen action; single-item rejection requires `alasan_penolakan`. |
| Dashboard | SELESAI | Admin, employee, finance, and owner dashboards call the role endpoint through the dashboard service. Dashboard request `jenis` fields use the contract enum; live screens use values returned by the API; greetings use `/auth/me`, and admin/employee topbar dates use dashboard response dates. | `NEXT_PUBLIC_MOCK_DASHBOARD` controls the module and falls back to `NEXT_PUBLIC_USE_MOCK`. Mock greetings/date and the employee attendance clock remain unchanged. Finance/owner dashboard contracts have no date/time field, so live topbar dates are omitted rather than taken from the browser or an unconfirmed endpoint. |
| Penggajian | SELESAI | Ringkasan memilih periode dari `GET /periode-gaji` dan memuat rincian sesuai periode terpilih. Komponen gaji mempertahankan `kode`, `nilai` null, dan `keterangan` dari API; PUT hanya mengirim field yang berubah dan daftar dimuat ulang dari API setelah simpan. Daftar hasil per periode dan daftar slip meneruskan `page`/`per_page`, membawa `meta` ke halaman, dan menampilkan pagination. Detail periode, rekap absensi, hitung, ajukan-validasi, kembalikan, setujui, bayar, pembatalan pembayaran/persetujuan, detail slip, dan PDF memakai service pada live mode. | Mock mode tetap memakai data contoh dan service daftar hasil memaginasi data demo. Tidak ada successful live round-trip yang tervalidasi. |
| Akuntansi | SELESAI | `GET /akun` dipanggil tanpa query dan tanpa ketergantungan pada `meta`; pencarian dan pagination akun dilakukan di sisi klien. Daftar jurnal meneruskan `search`, rentang tanggal, `sumber`, `status`, `periode_gaji_id`, `page`, dan `per_page`; status default `aktif`, sedangkan metadata pembatalan ditampilkan pada jurnal berstatus `dibatalkan`. Respons daftar jurnal menyertakan `ringkasan` debit, kredit, selisih, status seimbang, dan jumlah jurnal dari seluruh hasil filter sebelum pagination, tanpa jurnal dibatalkan. Nominal ringkasan memakai string desimal dua digit agar tetap presisi. Footer total tampil pada daftar berisi maupun kosong. Pembatalan jurnal manual memakai `DELETE /jurnal/{id}` dengan `alasan` wajib. Error validasi jurnal manual dipetakan ke tanggal, keterangan, akun, atau nominal. CRUD akun serta jurnal manual hanya tersedia bagi Keuangan. | Admin/HRD dan Pemilik read-only. Adapter mock mempertahankan daftar akun dan jurnal demo serta pagination di sisi klien; akun yang sudah dipakai jurnal tidak dapat dihapus. |
| Laporan | SELESAI | Tujuh laporan memanggil service dengan filter `periode` atau rentang periode/tanggal, `departemen_id`, `page`, dan `per_page`. Grafik memetakan `nilai_a` dan `nilai_b` ke dua seri dengan legend. | Katalog tetap mock karena kontrak tidak menyediakan endpoint katalog. Demo mendukung pilihan satu periode; rentang yang tidak dapat direpresentasikan oleh data demo menghasilkan keadaan kosong. |
| Notifikasi | SELESAI | Topbar memanggil `GET /notifikasi` dengan `page`/`per_page`, menambah halaman berikutnya tanpa duplikasi, menampilkan `jumlah_belum_dibaca`, dan memakai service untuk aksi baca satu/semua. | Mock mode memakai data demo dan pagination di adapter. |
| Pengaturan | SEBAGIAN | Live settings, holidays, users/role/status changes, logo upload, and password reset use service calls. NPWP, kuota cuti, pembagi hari kerja, and potongan izin tanpa surat are mapped through GET/PUT. Seluruh `lokasi_absensi` disimpan di adapter; PUT mengirim kembali array lengkap dan hanya memperbarui lokasi yang diedit. API validation errors for settings map to related fields; general errors remain visible. | Metode potongan alpha tetap read-only karena belum ada pemetaan UI yang disepakati. Backend routes are not registered in the checked-in routes. |

## Differences, assumptions, and backend decisions

- Employee create sends `nama`, `email`, `no_hp`, `jabatan_id`, `departemen_id`,
  `tanggal_mulai`, `jenis_penggajian`, `gaji_pokok`, `tunjangan_tetap`, `npwp`,
  `no_bpjs`, `role`, and initial `password`. Blank optional tax/insurance values are
  sent as `null`; `kode` is never sent. Validation errors map to form fields.
- Employee detail resolves master labels through `/jabatan` and `/departemen`,
  displays BPJS from `no_bpjs`, and requests attendance totals by `YYYY-MM`.
- The payroll wizard and summary page select existing periods. Payment sends
  `tanggal_bayar`, `akun_kas_id`, and optional `catatan`; the cash-account options
  include active asset accounts. The return action is limited to Keuangan while a
  period awaits validation and requires `catatan`. The mock return resets the period
  to Draft; confirm that the backend uses the same post-return status.
- Dashboard finance/owner views only display amounts provided by their dashboard
  responses. The owner endpoint provides attendance percentages, not the mock UI's
  present/late counts; live mode shows the returned percentage instead.
- Settings has no contract field for the old UI's fixed alpha-deduction amount.
  That input is hidden in live mode; the API method is displayed as returned and
  preserved unchanged. NPWP is edited under Perusahaan, kuota cuti under Jadwal &
  Jam Kerja, and pembagi hari kerja plus potongan izin tanpa surat under Kebijakan
  Penggajian. Existing demo settings are migrated with empty/default values for these
  newly exposed fields.
- Notifications load ten items per page and append subsequent pages without duplicate
  IDs. The bell count uses the API's `jumlah_belum_dibaca`; mock mode computes the
  equivalent from the demo read state.
- Attendance API status `dinas_luar` is displayed as its own status. Unknown API
  statuses still fail explicitly rather than being relabeled.
- The admin daily attendance page initializes its live date from `/absensi/hari-ini`;
  demo mode continues to use the fixed demo date.
- Dashboard mock selection is independent through `NEXT_PUBLIC_MOCK_DASHBOARD`, with
  the global mock switch as its default. Finance/owner dashboard responses have no
  date/time field, so their live topbar date is intentionally omitted unless the
  contract provides an authorized source.
- Both Pengajuan pages map UI filters to the contract query fields, debounce search
  for 300 ms, and display pagination and the response `ringkasan`. Employee requests
  omit `departemen_id` because the API scopes that list to the authenticated user.
- Pengajuan create sends only contract fields for each selected type: izin/sakit/cuti
  send `jenis`, `tanggal_mulai`, `tanggal_selesai`, `alasan`, and optional `lampiran`;
  koreksi_absensi sends `jenis`, `tanggal_mulai`, `jam_masuk_benar`,
  `jam_pulang_benar`, and `alasan`; lembur sends `jenis`, `tanggal_mulai`,
  `jam_mulai`, `jam_selesai`, and `alasan`. The latter two do not send
  `tanggal_selesai`. API error messages take precedence over friendly Indonesian
  fallbacks for `INSUFFICIENT_LEAVE_QUOTA`, `INVALID_STATUS_TRANSITION`,
  `JOURNAL_NOT_BALANCED`, and `INVALID_CREDENTIALS`.
- Dashboard pengajuan `jenis` fields use the `JenisPengajuan` contract enum.
  `NotifikasiList` includes its `ApiListMeta` pagination metadata.
- User reset-password displays the temporary password returned by the API in a
  success toast. Confirm with backend whether this response should instead be
  delivered through a one-time secure channel.
- `GET /akun` follows contract section 8.1: it returns a plain list with no query
  parameters or pagination metadata. Search and paging are client-side.
  `GET /jurnal` remains a paged list and requires its contract `meta`. Its top-level
  `ringkasan` aggregates integer cents with SQL `SUM` across every matching journal
  before pagination, honors the active date/search/source/period/status filters, and
  excludes cancelled journals. Its monetary fields are decimal strings with exactly
  two fractional digits. The footer displays the balance status for the filtered set.
- Journal lists send `status=aktif` by default, or `status=dibatalkan` or `status=semua`
  when selected. The summary still excludes cancelled journals. The contract's
  `status`, `dibatalkan_oleh`, `dibatalkan_pada`, and
  `alasan_pembatalan` fields are retained and shown for cancelled entries. Manual
  journal cancellation sends `DELETE /jurnal/{id}` with `{ alasan }`.
- Payroll cancellation sends `POST /periode-gaji/{id}/batalkan-pembayaran` or
  `POST /periode-gaji/{id}/batalkan-persetujuan`, each with `{ catatan }`. A
  `hadirpay-accounting-data-changed` event refreshes mounted journal, payroll-period,
  general-ledger, and trial-balance views after cancellation; each view loads its
  current API query when revisited.
- Editing a payroll component with only its amount changed sends a partial PUT body,
  for example `{"nilai":3}` for BPJS changing from 1 to 3. The value is a JSON number;
  an empty amount is sent as `null`. Unchanged `kode` is omitted, never replaced with
  the numeric record ID. Component enums use `tipe: "potongan"` and `metode: "persen"`
  when those fields change; the service maps UI method labels to the API enum.
- Backend validation found in `backend/app/Controllers/Api/V1/KomponenGaji.php`:
  `kode` is required, alpha_dash, max 30, and unique with the current `id` excluded
  on update; `nama` is required (2-100 characters); `tipe` is required and limited
  to `pendapatan|potongan`; `metode` is required and limited to
  `nominal_tetap|persen|per_hari|per_jam|per_menit`; `nilai` is optional, numeric,
  and >= 0, with `persen` capped at 100. `keterangan` is optional, and omitted
  `aktif` defaults to its existing value. The checked-in PUT controller runs those
  required rules on the partial request and then reads the required fields directly.
  That conflicts with the frontend's partial PUT contract and is the most likely
  cause of the reported 422. For the specific `{ "nilai": 3 }` request, code,
  name, type, and method are missing and fail `required`; the unchanged code's
  `is_unique` exclusion and the numeric percent value are not the cause.
- Laporan detail maps UI department names to `departemen_id` using the department
  master endpoint. The report catalog remains local because no catalog endpoint is
  specified. Mock report snapshots cannot represent arbitrary ranges and show an
  empty state for unsupported range selections.
- The backend routes in this workspace still differ from the contract: employee
  status uses `DELETE /karyawan/{id}` rather than the required PATCH, the two
  employee attendance routes are absent, employee reads are restricted to
  `admin_hrd`, and most dashboard/admin attendance/business module routes are not
  registered. Frontend does not call the non-contract employee DELETE route.
- No lint script was added because ESLint is not installed in `frontend`. TypeScript
  validation and the production build are the available checks.

## Contract endpoints not invoked by a current screen

No endpoint represented by the contract-oriented service inventory is known to be
uncalled by a current screen after the integrations above.

## Files changed by module

- **Auth:** `components/auth/login-form.tsx`, `components/app/app-shell.tsx`,
  `lib/auth/auth-provider.tsx`, `lib/services/auth.service.ts`, `lib/types/auth.ts`,
  `lib/api/client.ts`
- **Karyawan + master:** `components/admin/employees/employee-list.tsx`,
  `components/admin/employees/employee-form-dialog.tsx`,
  `components/admin/employees/employee-detail.tsx`,
  `components/admin/master-data/master-data-page.tsx`,
  `lib/services/karyawan.service.ts`, `lib/types/karyawan.ts`,
  `lib/mock/employees.ts`, `lib/mock/master-data.ts`
- **Absensi:** `components/employee/attendance-page.tsx`,
  `components/employee/attendance-history.tsx`,
  `components/admin/attendance/admin-attendance-page.tsx`,
  `components/admin/attendance/attendance-recap-page.tsx`,
  `components/hadirpay/status-badge.tsx`, `lib/services/absensi.service.ts`,
  `lib/services/admin-attendance-service.ts`, `lib/mock/attendance.ts`,
  `lib/services/attendance-service.ts`, `lib/types/absensi.ts`
- **Pengajuan:** `components/employee/requests-page.tsx`,
  `components/admin/requests-page.tsx`, `components/admin/approvals-list.tsx`,
  `lib/services/pengajuan.service.ts`, `lib/services/request-service.ts`,
  `lib/mock/requests.ts`,
  `lib/types/pengajuan.ts`, `lib/api/client.ts`
- **Dashboard:** `components/admin/admin-dashboard.tsx`,
  `components/admin/finance-dashboard.tsx`, `components/admin/owner-dashboard.tsx`,
  `components/employee/employee-dashboard.tsx`, `components/employee/payslip-card.tsx`,
  `components/hadirpay/attendance-chart.tsx`,
  `components/hadirpay/attendance-table.tsx`, `components/hadirpay/week-chips.tsx`,
  `components/app/role-dashboard.tsx`,
  `lib/services/dashboard.service.ts`, `lib/types/dashboard.ts`, `lib/mock-data.ts`
- **Penggajian:** `components/admin/payroll/payroll-page.tsx`,
  `components/admin/payroll/payroll-process-page.tsx`,
  `components/admin/payroll/payroll-components-page.tsx`,
  `components/admin/payroll/payslip-page.tsx`,
  `components/admin/employees/employee-detail.tsx`,
  `lib/services/penggajian.service.ts`, `lib/mock/payroll.ts`,
  `lib/services/payroll-service.ts`, `lib/types/penggajian.ts`
- **Akuntansi:** `components/admin/accounting/accounts-page.tsx`,
  `components/admin/accounting/journal-page.tsx`,
  `components/admin/accounting/general-ledger-page.tsx`,
  `components/admin/accounting/trial-balance-page.tsx`,
  `lib/services/akuntansi.service.ts`, `lib/services/accounting-service.ts`,
  `lib/services/accounting-events.ts`,
  `lib/services/accounting-storage.ts`, `lib/accounting/journal.ts`,
  `lib/mock/accounting.ts`, `lib/types/akuntansi.ts`,
  `lib/types/akuntansi.ts`, `lib/api/client.ts`
- **Laporan:** `components/admin/reports/reports-page.tsx`,
  `components/admin/finance-dashboard.tsx`, `components/admin/owner-dashboard.tsx`,
  `lib/services/laporan.service.ts`, `lib/services/report-service.ts`,
  `lib/types/laporan.ts`
- **Notifikasi:** `components/app/topbar.tsx`, `lib/services/notifikasi.service.ts`,
  `lib/services/notification-service.ts`, `lib/types/notifikasi.ts`
- **Pengaturan:** `components/admin/settings/settings-page.tsx`,
  `components/app/app-shell.tsx`, `lib/services/pengaturan.service.ts`,
  `lib/services/settings-service.ts`, `lib/services/karyawan.service.ts`,
  `lib/mock/settings.ts`,
  `lib/types/pengaturan.ts`
