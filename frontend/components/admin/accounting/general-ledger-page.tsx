"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, CircleDollarSign } from "lucide-react";
import { Panel } from "@/components/hadirpay/panel";
import { StatCard } from "@/components/hadirpay/stat-card";
import { StatusBadge } from "@/components/hadirpay/status-badge";
import { DemoDataNotice } from "@/components/ui/demo-data-notice";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { AccountingAccess, AccountingPageTitle } from "./accounting-shared";
import { useAccountingRole } from "@/lib/hooks/use-accounting-role";
import { formatAccountingDate } from "@/lib/accounting/journal";
import { formatRupiah } from "@/lib/mock-data";
import type { AccountingAccount } from "@/lib/mock/accounting";
import type { LedgerReport } from "@/lib/services/accounting-service";
import {
  getAccountLedger,
  listAccounts,
} from "@/lib/services/accounting-service";

const initialPeriod = "2026-11";

function balanceLabel(
  value: number,
  normalBalance: AccountingAccount["normalBalance"],
) {
  const side =
    value >= 0
      ? normalBalance.toLowerCase()
      : normalBalance === "Debit"
        ? "kredit"
        : "debit";
  return `${formatRupiah(Math.abs(value))} (saldo ${side})`;
}

export function GeneralLedgerPage() {
  const role = useAccountingRole();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [period, setPeriod] = useState(initialPeriod);
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const account = accounts.find((item) => item.code === accountCode);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const nextAccounts = await listAccounts();
        const selectedCode = nextAccounts.some(
          (item) => item.code === accountCode,
        )
          ? accountCode
          : (nextAccounts[0]?.code ?? "");
        if (active) {
          setAccounts(nextAccounts);
          if (selectedCode !== accountCode) setAccountCode(selectedCode);
        }
        const nextReport = selectedCode
          ? await getAccountLedger(selectedCode, period)
          : null;
        if (active) setReport(nextReport);
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Buku besar gagal dimuat.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }

    if (role === "admin" || role === "keuangan" || role === "pemilik")
      void load();
    else if (role === "karyawan" || role === null) setLoading(false);
    return () => {
      active = false;
    };
  }, [role, accountCode, period, retry]);

  return (
    <AccountingAccess role={role}>
      {loading ? (
        <PageLoadingSkeleton label="buku besar" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <DemoDataNotice>
            Saldo awal dihitung dari jurnal sebelum periode terpilih. Data demo
            tidak memiliki saldo awal historis di luar jurnal yang tersimpan.
          </DemoDataNotice>
          <AccountingPageTitle
            title="Buku besar"
            description="Telusuri mutasi akun dan saldo berjalan per periode."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
              Akun
              <select
                value={accountCode}
                onChange={(event) => setAccountCode(event.target.value)}
                className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                {accounts.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
              Periode
              <input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
            </label>
          </div>

          {account && report && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Saldo awal"
                  value={formatRupiah(Math.abs(report.openingBalance))}
                  hint={
                    report.openingBalance < 0
                      ? "Saldo berlawanan dari saldo normal"
                      : account.normalBalance
                  }
                  icon={CircleDollarSign}
                  tone="blue"
                />
                <StatCard
                  label="Mutasi periode"
                  value={String(report.movements.length)}
                  hint={`${account.code} · ${period}`}
                  icon={CalendarDays}
                  tone="amber"
                />
                <StatCard
                  label="Saldo akhir"
                  value={formatRupiah(Math.abs(report.closingBalance))}
                  hint={
                    report.closingBalance < 0
                      ? "Saldo berlawanan dari saldo normal"
                      : account.normalBalance
                  }
                  icon={BookOpen}
                  tone="green"
                />
              </div>

              <Panel
                title={`${account.code} · ${account.name}`}
                description={`Saldo normal ${account.normalBalance.toLowerCase()} untuk kategori ${account.category.toLowerCase()}.`}
              >
                {report.movements.length === 0 ? (
                  <EmptyState
                    title="Belum ada mutasi pada periode ini"
                    description="Setujui penggajian untuk membentuk jurnal otomatis, atau catat jurnal manual."
                    icon={BookOpen}
                    action={
                      <Link
                        href="/app/akuntansi/jurnal"
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Buka jurnal umum
                      </Link>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Mutasi buku besar {account.name} untuk {period}
                      </caption>
                      <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-3">
                            Tanggal
                          </th>
                          <th scope="col" className="px-3 py-3">
                            No. bukti
                          </th>
                          <th scope="col" className="px-3 py-3">
                            Keterangan
                          </th>
                          <th scope="col" className="px-3 py-3 text-right">
                            Debit
                          </th>
                          <th scope="col" className="px-3 py-3 text-right">
                            Kredit
                          </th>
                          <th scope="col" className="px-3 py-3 text-right">
                            Saldo berjalan
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="bg-surface/70">
                          <th
                            scope="row"
                            colSpan={3}
                            className="px-3 py-3 font-semibold text-heading"
                          >
                            Saldo awal
                          </th>
                          <td
                            colSpan={3}
                            className="px-3 py-3 text-right font-semibold tabular-nums text-heading"
                          >
                            {balanceLabel(
                              report.openingBalance,
                              account.normalBalance,
                            )}
                          </td>
                        </tr>
                        {report.movements.map((movement) => (
                          <tr
                            key={`${movement.entry.id}-${account.code}`}
                            className="hover:bg-surface/70"
                          >
                            <td className="whitespace-nowrap px-3 py-3">
                              {formatAccountingDate(movement.entry.date)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-heading">
                              {movement.entry.voucherNumber}
                            </td>
                            <td className="px-3 py-3">
                              <p>{movement.entry.description}</p>
                              {movement.entry.sourcePeriodLabel && (
                                <Link
                                  href="/app/penggajian"
                                  className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                                >
                                  Penggajian {movement.entry.sourcePeriodLabel}
                                </Link>
                              )}
                              <span className="mt-1 block">
                                <StatusBadge status={movement.entry.type} />
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                              {movement.debit
                                ? formatRupiah(movement.debit)
                                : "-"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                              {movement.credit
                                ? formatRupiah(movement.credit)
                                : "-"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-heading">
                              {balanceLabel(
                                movement.runningBalance,
                                account.normalBalance,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-surface font-bold text-heading">
                        <tr>
                          <th
                            scope="row"
                            colSpan={5}
                            className="px-3 py-3 text-right"
                          >
                            Saldo akhir
                          </th>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {balanceLabel(
                              report.closingBalance,
                              account.normalBalance,
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          )}
          {accounts.length === 0 && (
            <EmptyState
              title="Bagan akun belum tersedia"
              description="Tambahkan data akun sebelum membuka buku besar."
              icon={BookOpen}
            />
          )}
        </div>
      )}
    </AccountingAccess>
  );
}
