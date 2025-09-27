<?php
// Run: APP_ID=app_xxx php -S localhost:8001 teller.php

$appId   = getenv("APP_ID") or die("APP_ID must be set\n");
$env     = getenv("ENV") ?: "sandbox";
$cert    = getenv("CERT");
$certKey = getenv("CERT_KEY");

if (in_array($env, ["development", "production"]) && (!$cert || !$certKey)) {
    die("CERT and CERT_KEY must be set when ENV=$env\n");
}

$baseDir = __DIR__ . "/../static";
$uri     = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
$method  = $_SERVER["REQUEST_METHOD"];

// ---------- Root ----------
if ($uri === "/") {
    $html = str_replace(
        ["{{ app_id }}", "{{ environment }}"],
        [$appId, $env],
        file_get_contents("$baseDir/index.html")
    );
    header("Content-Type: text/html");
    echo $html;
    exit;
}

// ---------- Static ----------
if (strpos($uri, "/static/") === 0) {
    $path = substr($uri, 8); // after "/static/"
    $file = realpath("$baseDir/$path");
    if ($file && file_exists($file)) {
        header("Content-Type: " . mime_content_type($file));
        readfile($file);
    } else {
        http_response_code(404);
        echo "Not found";
    }
    exit;
}

// ---------- Proxy /api/* ----------
if (strpos($uri, "/api/") === 0) {
    $url = "https://api.teller.io/" . substr($uri, 5); // after "/api/"
    $headers = [];

    if (isset($_SERVER["HTTP_AUTHORIZATION"])) {
        $token = trim($_SERVER["HTTP_AUTHORIZATION"]);
        $headers[] = "Authorization: Basic " . base64_encode("$token:");
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER    => $headers,
        CURLOPT_RETURNTRANSFER=> true,
        CURLOPT_POSTFIELDS    => file_get_contents("php://input"),
    ]);
    if ($cert && $certKey) {
        curl_setopt($ch, CURLOPT_SSLCERT, $cert);
        curl_setopt($ch, CURLOPT_SSLKEY, $certKey);
    }

    $respBody = curl_exec($ch);
    $status   = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    header("Content-Type: application/json");
    http_response_code($status);
    echo $respBody;
    exit;
}

// ---------- Default ----------
http_response_code(404);
echo "Not found";