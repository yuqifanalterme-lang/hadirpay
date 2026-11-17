"use client";

import { useEffect, useState } from "react";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/empty-state";
import type { ApprovalRequest } from "@/lib/mock/requests";
import { decideRequest, listRequests } from "@/lib/services/request-service";

export function ApprovalsList() {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems((await listRequests()).filter((item) => item.status === "Menunggu persetujuan"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Pengajuan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(item: ApprovalRequest, approved: boolean) {
    if (!approved) {
      setSelected(item);
      setReason("");
      return;
    }
    setSubmitting(true);
    try {
      await decideRequest(item.id, "Disetujui", "Rina Kartika (HRD)");
      setItems((current) => current.filter((request) => request.id !== item.id));
      toast.success(`Pengajuan ${item.type.toLowerCase()} ${item.name} disetujui.`);
    } catch (decisionError) {
      toast.error(decisionError instanceof Error ? decisionError.message : "Pengajuan gagal diproses.");
    } finally {
      setSubmitting(false);
    }
  }

  async function rejectSelected() {
    if (!selected || !reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await decideRequest(selected.id, "Ditolak", "Rina Kartika (HRD)", reason);
      setItems((current) => current.filter((request) => request.id !== selected.id));
      setSelected(null);
      toast.success(`Pengajuan ${selected.type.toLowerCase()} ${selected.name} ditolak.`);
    } catch (decisionError) {
      toast.error(decisionError instanceof Error ? decisionError.message : "Pengajuan gagal diproses.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat pengajuan">
        <span className="sr-only">Memuat pengajuan</span>
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-24 rounded-2xl bg-muted" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-4 py-10 text-center">
        <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold text-heading">
          Semua pengajuan sudah diproses
        </p>
        <p className="text-sm text-muted-foreground">
          Pengajuan baru akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3" aria-live="polite">
        {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
        >
          <div className="flex items-start gap-3">
            <Avatar initials={item.initials} size="lg" tone="outlined" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-heading">{item.name}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-heading">
                  {item.type}
                </span>
              </div>
              <p className="text-sm text-foreground">{item.reason}</p>
              <p className="text-xs text-muted-foreground">{item.department} · {item.days} hari</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => void decide(item, false)}
              variant="dangerOutline"
              size="action"
              disabled={submitting}
              className="justify-center transition-colors duration-150"
            >
              <X className="size-4" aria-hidden="true" />
              Tolak
              <span className="sr-only">pengajuan {item.name}</span>
            </Button>
            <Button
              type="button"
              onClick={() => void decide(item, true)}
              variant="success"
              size="action"
              disabled={submitting}
              className="justify-center transition-colors duration-150"
            >
              <Check className="size-4" aria-hidden="true" />
              Setujui
              <span className="sr-only">pengajuan {item.name}</span>
            </Button>
          </div>
        </li>
        ))}
      </ul>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        label="Alasan menolak pengajuan"
      >
        {selected && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void rejectSelected();
            }}
          >
            <DialogHeader
              title="Tolak pengajuan"
              description={`${selected.name} · ${selected.type}`}
              onClose={() => setSelected(null)}
            />
            <div className="flex flex-col gap-2 p-5 sm:p-6">
              <label htmlFor="dashboard-rejection-reason" className="text-sm font-semibold text-heading">
                Alasan penolakan
              </label>
              <textarea
                id="dashboard-rejection-reason"
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="action" onClick={() => setSelected(null)}>
                Batal
              </Button>
              <Button type="submit" variant="dangerOutline" size="action" disabled={submitting || !reason.trim()}>
                {submitting ? "Menyimpan..." : "Konfirmasi penolakan"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </>
  );
}
