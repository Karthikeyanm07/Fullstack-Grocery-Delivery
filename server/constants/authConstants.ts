// src/constants/authConstants.ts

// Token & cookie lifetime — both must always match
export const AUTH_TOKEN_EXPIRY = "30d";
export const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Rate limiting — login
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Rate limiting — register (looser, but still needed)
export const REGISTER_MAX_ATTEMPTS = 10;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Rate limiting — image upload (per user ID, not IP — only logged-in users upload)
export const UPLOAD_MAX_ATTEMPTS = 30;
export const UPLOAD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Rate limiting — admin product writes (per user ID)
export const PRODUCT_WRITE_MAX_ATTEMPTS = 60;
export const PRODUCT_WRITE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Rate limiting — order creation (per user ID — prevents order spam)
export const ORDER_CREATE_MAX_ATTEMPTS = 10;
export const ORDER_CREATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// bcrypt
export const BCRYPT_ROUNDS = 12;

// Business rules
export const FREE_DELIVERY_THRESHOLD = 500; // free delivery above this subtotal
export const DELIVERY_FEE = 100;
export const TAX_RATE = 0.08; // 8