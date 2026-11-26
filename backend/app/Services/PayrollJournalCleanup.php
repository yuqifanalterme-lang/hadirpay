<?php

namespace App\Services;

class PayrollJournalCleanup
{
    public static function hapusJurnalOtomatisTerkait($db, array $periode): void
    {
        $periodeId = (int) $periode['id'];
        $journalIds = array_map('intval', array_column(
            $db->table('jurnal')->select('id')
                ->where('periode_gaji_id', $periodeId)
                ->where('sumber', 'otomatis')
                ->get()->getResultArray(),
            'id'
        ));

        $journalIds = array_merge($journalIds, array_filter([
            isset($periode['jurnal_pengakuan_id']) ? (int) $periode['jurnal_pengakuan_id'] : null,
            isset($periode['jurnal_pembayaran_id']) ? (int) $periode['jurnal_pembayaran_id'] : null,
        ]));
        $journalIds = array_unique($journalIds);

        if ($journalIds) {
            $journalIds = array_map('intval', array_column(
                $db->table('jurnal')->select('id')
                    ->whereIn('id', $journalIds)
                    ->where('sumber', 'otomatis')
                    ->get()->getResultArray(),
                'id'
            ));
        }

        $knownJournalIds = array_fill_keys($journalIds, true);
        $frontier = $journalIds;
        while ($frontier) {
            $children = $db->table('jurnal')->select('id')
                ->whereIn('reversal_of', $frontier)
                ->get()->getResultArray();
            $frontier = [];
            foreach ($children as $child) {
                $childId = (int) $child['id'];
                if (! isset($knownJournalIds[$childId])) {
                    $knownJournalIds[$childId] = true;
                    $frontier[] = $childId;
                }
            }
        }

        $db->table('periode_gaji')->where('id', $periodeId)->update([
            'jurnal_pengakuan_id'  => null,
            'jurnal_pembayaran_id' => null,
        ]);

        if ($knownJournalIds) {
            $ids = array_map('intval', array_keys($knownJournalIds));
            $db->table('jurnal')->whereIn('id', $ids)->update(['reversal_of' => null]);
            $db->table('jurnal')->whereIn('id', $ids)->delete();
        }
    }
}
