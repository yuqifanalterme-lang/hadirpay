"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { Panel } from "@/components/hadirpay/panel";
import { StatCard } from "@/components/hadirpay/stat-card";
import { StatusBadge } from "@/components/hadirpay/status-badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { AccountingAccess, AccountingPageTitle } from "./accounting-shared";
import { useAccountingRole } from "@/lib/hooks/use-accounting-role";
import { formatRupiah } from "@/lib/mock-data";
import { accountingDataChangedEvent } from "@/lib/services/accounting-events";
import type { TrialBalanceReport } from "@/lib/services/akuntansi.service";
import { getTrialBalance } from "@/lib/services/akuntansi.service";

export function TrialBalancePage() {
  const role = useAccountingRole();
  const [period, setPeriod] = useState("2026-11");
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const nextReport = await getTrialBalance(period);
        if (active) setReport(nextReport);
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Neraca saldo gagal dimuat.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }

    const refresh = () => void load();
    window.addEventListener(accountingDataChangedEvent, refresh);
    if (role === "admin" || role === "keuangan" || role === "pemilik")
      void load();
    else if (role === "karyawan" || role === null) setLoading(false);
    return () => {
      active = false;
      window.removeEventListener(accountingDataChangedEvent, refresh);
    };
  }, [role, period, retry]);

  return (
    <AccountingAccess role={role}>
      {loading ? (
        <PageLoadingSkeleton label="neraca saldo" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : !report ? (
        <EmptyState
          title="Neraca saldo belum tersedia"
          description="Periksa periode lalu coba muat ulang data."
          icon={Scale}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <AccountingPageTitle
            title="Neraca saldo"
            description="Bandingkan total debit dan kredit dari jurnal pada satu periode."
          />
          <label className="flex max-w-sm flex-col gap-2 text-sm font-semibold text-heading">
            Periode
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Total debit"
              value={formatRupiah(report.totalDebit)}
              hint={`Periode ${period}`}
              icon={Scale}
              tone="blue"
            />
            <StatCard
              label="Total kredit"
              value={formatRupiah(report.totalCredit)}
              hint={`Periode ${period}`}
              icon={Scale}
              tone="green"
            />
          </div>
          <Panel
            title="Saldo per akun"
            description="Jumlah kolom debit dan kredit harus sama untuk setiap periode."
            action={
              <StatusBadge
                status={report.balanced ? "Seimbang" : "Tidak seimbang"}
              />
            }
          >
            {!report.hasTransactions && (
              <EmptyState
                title="Belum ada jurnal pada periode ini"
                description="Data akun tetap ditampilkan dengan saldo nol. Setujui penggajian atau buat jurnal manual untuk mencatat mutasi."
                icon={Scale}
              />
            )}
            <div className="no-scrollbar overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Neraca saldo per akun untuk {period}
                </caption>
                <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Kode
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Nama akun
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Kategori
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Debit
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Kredit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.rows.map((row) => (
                    <tr key={row.account.code} className="hover:bg-surface/70">
                      <td className="px-4 py-3 font-semibold tabular-nums text-heading">
                        {row.account.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-heading">
                        {row.account.name}
                      </td>
                      <td className="px-4 py-3">{row.account.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatRupiah(row.debit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatRupiah(row.credit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface font-bold text-heading">
                  <tr>
                    <th
                      scope="row"
                      colSpan={3}
                      className="px-4 py-3 text-right"
                    >
                      Jumlah
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatRupiah(report.totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatRupiah(report.totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </AccountingAccess>
  );
}
