export const AUTH_TOKEN_EXPIRY = "30d";
export const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const REGISTER_MAX_ATTEMPTS = 10;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000; 

export const UPLOAD_MAX_ATTEMPTS = 30;
export const UPLOAD_WINDOW_MS = 60 * 60 * 1000; 

export const PRODUCT_WRITE_MAX_ATTEMPTS = 60;
export const PRODUCT_WRITE_WINDOW_MS = 60 * 60 * 1000; 

export const ORDER_CREATE_MAX_ATTEMPTS = 10;
export const ORDER_CREATE_WINDOW_MS = 60 * 60 * 1000; 

export const ADDRESS_WRITE_MAX_ATTEMPTS = 20;
export const ADDRESS_WRITE_WINDOW_MS = 60 * 60 * 1000; 

export const PARTNER_LOGIN_MAX_ATTEMPTS = 5;
export const PARTNER_LOGIN_WINDOW_MS = 15 * 60 * 1000; 

// bcrypt
export const BCRYPT_ROUNDS = 12;

// Business rules
export const FREE_DELIVERY_THRESHOLD = 500; 
export const DELIVERY_FEE = 100;
export const TAX_RATE = 0.08; // 8
export const MAX_ADDRESSES_PER_USER = 10;
