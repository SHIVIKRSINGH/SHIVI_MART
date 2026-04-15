// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // API Base URL - Change this to your server URL
    API_URL: 'https://shivimart.softgensys.com/api',
    
    // For production, use your domain:
    // API_URL: 'https://yourdomain.com/api',
    
    // Local Storage Keys
    STORAGE_KEYS: {
        AUTH_TOKEN: 'grocery_auth_token',
        USER_DATA: 'grocery_user_data',
        CART_DATA: 'grocery_cart',
        ADDRESS_DATA: 'grocery_address'
    },
    
    // App Settings
    SETTINGS: {
        DEFAULT_CATEGORY: 'all',
        TOAST_DURATION: 3000,
        OTP_LENGTH: 6,
        MOBILE_LENGTH: 10
    }
};

// Make CONFIG available globally
window.CONFIG = CONFIG;
