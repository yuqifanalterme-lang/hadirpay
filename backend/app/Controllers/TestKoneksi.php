<?php

namespace App\Controllers;

use CodeIgniter\Controller;
use Config\Database;

class TestKoneksi extends Controller
{
    public function index()
    {
        try {
            // Mencoba melakukan koneksi ke database
            $db = Database::connect();
            
            // Ambil versi database untuk memastikan koneksi hidup
            $query = $db->query('SELECT version();');
            $result = $query->getRow();

            return $this->response->setJSON([
                'status' => 'success',
                'message' => 'Berhasil terhubung ke database Supabase!',
                'db_version' => $result->version
            ]);
        } catch (\Throwable $e) {
            return $this->response->setJSON([
                'status' => 'error',
                'message' => 'Gagal terhubung ke database.',
                'error_detail' => $e->getMessage()
            ]);
        }
    }
}