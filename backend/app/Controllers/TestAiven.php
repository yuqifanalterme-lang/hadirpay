<?php

namespace App\Controllers;

use CodeIgniter\Controller;
use Config\Database;

class TestAiven extends Controller
{
    public function index()
    {
        try {
            $db = Database::connect();
            // Cek versi MySQL yang sedang digunakan di Aiven
            $query = $db->query('SELECT VERSION() as version;');
            $result = $query->getRow();

            return $this->response->setJSON([
                'status' => 'success',
                'message' => 'Hore! Berhasil tersambung ke Aiven MySQL Cloud!',
                'server_version' => $result->version
            ]);
        } catch (\Throwable $e) {
            return $this->response->setJSON([
                'status' => 'error',
                'message' => 'Gagal terhubung ke Aiven Cloud.',
                'error_detail' => $e->getMessage()
            ]);
        }
    }
}