<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use CodeIgniter\Database\BaseConnection;
use RuntimeException;
use Throwable;

class ResetPayroll extends BaseCommand
{
    protected $group       = 'Hadirpay';
    protected $name        = 'hadirpay:reset-payroll';
    protected $description = 'Dry-run or clear payroll and accounting transaction data.';
    protected $usage       = 'hadirpay:reset-payroll [--force] [--with-attendance] [--i-know-this-is-production]';
    protected $options     = [
        '--force'                       => 'Delete the listed transaction data. Without this option, only show row counts.',
        '--with-attendance'             => 'Also delete absensi and pengajuan_izin rows.',
        '--i-know-this-is-production'   => 'Allow a destructive run in the production environment.',
    ];

    private const TRANSACTION_TABLES = [
        'detail_jurnal',
        'slip_gaji',
        'detail_penggajian',
        'jurnal',
        'penggajian',
        'periode_status_log',
        'periode_gaji',
    ];

    private const ATTENDANCE_TABLES = [
        'absensi',
        'pengajuan_izin',
    ];

    public function run(array $params)
    {
        $db               = db_connect();
        $environment      = $this->environment();
        $databaseName     = $db->getDatabase();
        $host             = (string) $db->hostname;
        $force            = $this->optionEnabled($params, 'force');
        $withAttendance   = $this->optionEnabled($params, 'with-attendance');
        $productionOptIn  = $this->optionEnabled($params, 'i-know-this-is-production');
        $tables           = self::TRANSACTION_TABLES;

        if ($withAttendance) {
            $tables = [...$tables, ...self::ATTENDANCE_TABLES];
        }

        CLI::write("Target database: {$databaseName}");
        CLI::write("Target host: {$host}");
        CLI::write("Environment: {$environment}");

        try {
            $counts = $this->countRows($db, $tables);
        } catch (Throwable $e) {
            CLI::error('Could not inspect reset tables: ' . $e->getMessage());
            return 1;
        }

        foreach ($counts as $table => $count) {
            CLI::write(sprintf('%s: %d row(s)', $table, $count));
        }

        if (! $force) {
            CLI::write('DRY-RUN: no rows were changed.');
            return 0;
        }

        if (strtolower($environment) === 'production' && ! $productionOptIn) {
            CLI::error('Destructive reset refused in production. Add --i-know-this-is-production to continue.');
            return 1;
        }

        if ($databaseName === '') {
            CLI::error('Destructive reset refused because the database name is empty.');
            return 1;
        }

        if ($this->confirmDatabaseName($databaseName) !== $databaseName) {
            CLI::error('Database name did not match. No rows were changed.');
            return 1;
        }

        return $this->deleteRows($db, $tables);
    }

    protected function environment(): string
    {
        return defined('ENVIRONMENT') ? ENVIRONMENT : 'unknown';
    }

    protected function confirmDatabaseName(string $databaseName): string
    {
        return trim(CLI::prompt("Type database name '{$databaseName}' to continue"));
    }

    private function optionEnabled(array $params, string $name): bool
    {
        if (array_key_exists($name, $params)) {
            $value = $params[$name];

            return $value === null || $value === true || $value === 1 || $value === '1' || $value === 'true';
        }

        $value = CLI::getOption($name);

        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }

    /**
     * @param list<string> $tables
     *
     * @return array<string, int>
     */
    private function countRows(BaseConnection $db, array $tables): array
    {
        $counts = [];
        foreach ($tables as $table) {
            $counts[$table] = $db->table($table)->countAllResults();
        }

        return $counts;
    }

    /**
     * @param list<string> $tables
     */
    private function deleteRows(BaseConnection $db, array $tables): int
    {
        if (! $db->transBegin()) {
            CLI::error('Could not start the reset transaction.');
            return 1;
        }

        try {
            $periodReferences = [];
            foreach (['jurnal_pengakuan_id', 'jurnal_pembayaran_id'] as $column) {
                if ($db->fieldExists($column, 'periode_gaji')) {
                    $periodReferences[$column] = null;
                }
            }
            if ($periodReferences !== []) {
                $result = $db->table('periode_gaji')->update($periodReferences);
                if ($result === false) {
                    throw new RuntimeException('Could not clear journal references from periode_gaji.');
                }
            }

            if ($db->fieldExists('reversal_of', 'jurnal')) {
                $result = $db->table('jurnal')->update(['reversal_of' => null]);
                if ($result === false) {
                    throw new RuntimeException('Could not clear self-references from jurnal.');
                }
            }

            $deleted = [];
            foreach ($tables as $table) {
                $result = $db->query('DELETE FROM ' . $db->prefixTable($table));
                if ($result === false) {
                    throw new RuntimeException("Could not delete rows from {$table}.");
                }
                $deleted[$table] = $db->affectedRows();
            }

            if (! $db->transStatus()) {
                throw new RuntimeException('The database marked the reset transaction as failed.');
            }
            if (! $db->transCommit()) {
                throw new RuntimeException('Could not commit the reset transaction.');
            }
        } catch (Throwable $e) {
            $rolledBack = $db->transRollback();
            if ($rolledBack) {
                $db->resetTransStatus();
            }
            CLI::error('Reset failed: ' . $e->getMessage());
            CLI::error($rolledBack ? 'All changes were rolled back.' : 'Rollback could not be confirmed.');
            return 1;
        }

        CLI::write('Deleted rows:');
        foreach ($deleted as $table => $count) {
            CLI::write(sprintf('%s: %d row(s)', $table, $count));
        }
        CLI::write('Reset complete. Auto-increment IDs were not reset; journal numbers are derived from existing journal rows.');

        return 0;
    }
}
