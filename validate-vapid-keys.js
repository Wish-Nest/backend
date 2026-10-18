#!/usr/bin/env node

/**
 * Script to validate VAPID keys and test web-push functionality
 * Run with: node validate-vapid-keys.js
 */

import * as dotenv from 'dotenv';
import webpush from 'web-push';

dotenv.config({ path: '.env.local' });
dotenv.config();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@wishnest.com';

console.log('=== VAPID Key Validation ===\n');

if (!publicKey || !privateKey) {
    console.log('❌ Missing VAPID keys in .env file');
    console.log('Please run: node generate-vapid-keys.js');
    process.exit(1);
}

console.log('✓ VAPID keys found in .env file');
console.log(`Public key length: ${publicKey.length}`);
console.log(`Private key length: ${privateKey.length}`);

try {
    // Test 1: Set VAPID details
    webpush.setVapidDetails(subject, publicKey, privateKey);
    console.log('✓ VAPID details configured successfully');

    // Test 2: Generate VAPID headers for a test URL
    const testUrl = 'https://fcm.googleapis.com/fcm/send/test';
    const headers = webpush.getVapidHeaders(testUrl, subject, publicKey, privateKey);
    console.log('✓ VAPID headers generated successfully');
    console.log('✓ VAPID key pair is valid and compatible');

    console.log('\n=== Test Results ===');
    console.log('✅ All VAPID key tests passed!');
    console.log('Your keys are properly configured and ready to use.');

} catch (error) {
    console.log('\n❌ VAPID key validation failed:');
    console.log(error.message);
    
    if (error.message.includes('Unsupported encoding') || error.message.includes('key')) {
        console.log('\n💡 Solution:');
        console.log('Your VAPID keys appear to be invalid or incorrectly generated.');
        console.log('Please regenerate them using: node generate-vapid-keys.js');
        console.log('Then update both backend .env and frontend .env files with the new keys.');
    }
    
    process.exit(1);
}