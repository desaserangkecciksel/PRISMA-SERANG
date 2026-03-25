<?php
/**
 * API Backend for Hostinger (MySQL)
 * This script handles data storage for Prismades.
 * It automatically creates the necessary tables on first run.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// --- DATABASE CONFIGURATION ---
// Fill these details from your Hostinger Control Panel (hPanel)
$db_host = "srv1151.hstgr.io"; // Usually 'localhost' on Hostinger
$db_user = "u581740370_admin_apbdes"; // Your MySQL Username
$db_pass = "Serang2026";    // Your MySQL Password
$db_name = "u581740370_db_apbdes";   // Your Database Name

// Connect to MySQL
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database Connection Failed: " . $conn->connect_error]);
    exit;
}

// --- AUTO-INSTALL: CREATE TABLES IF NOT EXISTS ---
$tables = [
    "CREATE TABLE IF NOT EXISTS espm_letters (
        id VARCHAR(50) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS espm_employees (
        id VARCHAR(50) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS espm_settings (
        id VARCHAR(50) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )"
];

foreach ($tables as $sql) {
    if (!$conn->query($sql)) {
        http_response_code(500);
        echo json_encode(["error" => "Table Creation Failed: " . $conn->error]);
        exit;
    }
}

// --- API ROUTING ---
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'letters':
        handleLetters($method, $conn);
        break;
    case 'employees':
        handleEmployees($method, $conn);
        break;
    case 'settings':
        handleSettings($method, $conn);
        break;
    default:
        echo json_encode(["status" => "online", "message" => "Prismades API is ready."]);
        break;
}

$conn->close();

// --- HANDLERS ---

function handleLetters($method, $conn) {
    if ($method === 'GET') {
        $result = $conn->query("SELECT data FROM espm_letters ORDER BY created_at DESC");
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = json_decode($row['data']);
        }
        echo json_encode($data);
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $conn->real_escape_string($input['id']);
        $data = $conn->real_escape_string(json_encode($input));
        
        $sql = "INSERT INTO espm_letters (id, data) VALUES ('$id', '$data') 
                ON DUPLICATE KEY UPDATE data = '$data'";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => $conn->error]);
        }
    } elseif ($method === 'DELETE') {
        $id = $conn->real_escape_string($_GET['id']);
        $conn->query("DELETE FROM espm_letters WHERE id = '$id'");
        echo json_encode(["success" => true]);
    }
}

function handleEmployees($method, $conn) {
    if ($method === 'GET') {
        $result = $conn->query("SELECT data FROM espm_employees ORDER BY created_at ASC");
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = json_decode($row['data']);
        }
        echo json_encode($data);
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $conn->real_escape_string($input['id']);
        $data = $conn->real_escape_string(json_encode($input));
        
        $sql = "INSERT INTO espm_employees (id, data) VALUES ('$id', '$data') 
                ON DUPLICATE KEY UPDATE data = '$data'";
        $conn->query($sql);
        echo json_encode(["success" => true]);
    } elseif ($method === 'DELETE') {
        $id = $conn->real_escape_string($_GET['id']);
        $conn->query("DELETE FROM espm_employees WHERE id = '$id'");
        echo json_encode(["success" => true]);
    }
}

function handleSettings($method, $conn) {
    if ($method === 'GET') {
        $id = 'global_settings';
        $result = $conn->query("SELECT data FROM espm_settings WHERE id = '$id'");
        if ($row = $result->fetch_assoc()) {
            echo $row['data'];
        } else {
            echo json_encode(null);
        }
    } elseif ($method === 'POST') {
        $id = 'global_settings';
        $data = $conn->real_escape_string(file_get_contents('php://input'));
        
        $sql = "INSERT INTO espm_settings (id, data) VALUES ('$id', '$data') 
                ON DUPLICATE KEY UPDATE data = '$data'";
        $conn->query($sql);
        echo json_encode(["success" => true]);
    }
}
?>
