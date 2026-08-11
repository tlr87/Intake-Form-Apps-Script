<?php
/**
 * RD3 Tech - Website Contact Form Handler
 * File: contact.php
 */

header('Content-Type: application/json');

// Configuration
$webAppUrl = 'HTTPS://SCRIPT.GOOGLE.COM/MACROS/S/YOUR_DEPLOYMENT_ID/EXEC'; 

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // 1. Sanitize input fields
    $payload = [
        'name'     => filter_input(INPUT_POST, 'name', FILTER_SANITIZE_SPECIAL_CHARS) ?? '',
        'email'    => filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL) ? $_POST['email'] : '',
        'phone'    => filter_input(INPUT_POST, 'phone', FILTER_SANITIZE_SPECIAL_CHARS) ?? '',
        'message'  => filter_input(INPUT_POST, 'message', FILTER_SANITIZE_SPECIAL_CHARS) ?? '',
        'website'  => $_POST['website'] ?? '' // Honeypot field
    ];

    // 2. Validate required parameters
    if (empty($payload['name']) || empty($payload['email']) || empty($payload['message'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }

    // 3. Dispatch payload to Google Apps Script Webhook
    $ch = curl_init($webAppUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Follow GAS 302 redirects
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    $response   = curl_exec($ch);
    $curlError  = curl_error($ch);
    $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // 4. Return API response to frontend
    if ($httpCode === 200 && !$curlError) {
        echo json_encode(['status' => 'success', 'message' => 'Your message has been sent successfully.']);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Service temporarily unavailable. Please try again.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
}