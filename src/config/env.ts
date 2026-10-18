import * as dotenv from "dotenv";

// .env.local (non versionné) permet de surcharger les valeurs par défaut de .env
dotenv.config({ path: ".env.local" });
dotenv.config();

function _getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (!value) {
        throw new Error(`❌ Missing environment variable: ${key}`);
    }
    return value;
}

export const ENV = {
    MAIL_HOST: _getEnvVar('MAIL_HOST', 'smtp.gmail.com'),
    MAIL_PORT: parseInt(_getEnvVar('MAIL_PORT', '587')),
    MAIL_USER: _getEnvVar('MAIL_USER'),
    MAIL_PASS: _getEnvVar('MAIL_PASS'),
    MAIL_SECURE: _getEnvVar('MAIL_SECURE', 'false') === 'true',
    JWT_SECRET: _getEnvVar('JWT_SECRET', 'supersecret'),
    VAPID_PUBLIC_KEY: _getEnvVar('VAPID_PUBLIC_KEY'),
    VAPID_PRIVATE_KEY: _getEnvVar('VAPID_PRIVATE_KEY'),
    VAPID_SUBJECT: _getEnvVar('VAPID_SUBJECT', 'mailto:admin@wishnest.com'),
};