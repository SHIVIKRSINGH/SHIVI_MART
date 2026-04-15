// ============================================
// API SERVICE
// All backend API calls
// ============================================

const API = {
    // Get auth token from storage
    getAuthToken() {
        return Utils.storage.get(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    },
    
    // Make authenticated request
    async request(endpoint, options = {}) {
        const token = this.getAuthToken();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                ...options,
                headers
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Authentication
    auth: {
        async sendOTP(mobile) {
            return API.request('/auth/send-otp', {
                method: 'POST',
                body: JSON.stringify({ mobile })
            });
        },
        
        async verifyOTP(mobile, otp) {
            const response = await API.request('/auth/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ mobile, otp })
            });
            
            // Save token and user data
            if (response.token) {
                Utils.storage.set(CONFIG.STORAGE_KEYS.AUTH_TOKEN, response.token);
                Utils.storage.set(CONFIG.STORAGE_KEYS.USER_DATA, response.user);
            }
            
            return response;
        },
        
        async getProfile() {
            return API.request('/auth/me');
        },
        
        async updateProfile(name, email) {
            return API.request('/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, email })
            });
        },
        
        logout() {
            Utils.storage.remove(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
            Utils.storage.remove(CONFIG.STORAGE_KEYS.USER_DATA);
            Utils.storage.remove(CONFIG.STORAGE_KEYS.ADDRESS_DATA);
            window.location.reload();
        }
    },
    
    // Societies & Addresses
    societies: {
        async getAll() {
            return API.request('/societies');
        },
        
        async addAddress(addressData) {
            const response = await API.request('/societies/address', {
                method: 'POST',
                body: JSON.stringify(addressData)
            });
            
            // Save address to local storage
            Utils.storage.set(CONFIG.STORAGE_KEYS.ADDRESS_DATA, addressData);
            
            return response;
        },
        
        async getMyAddresses() {
            return API.request('/societies/my-addresses');
        },
        
        async updateAddress(id, addressData) {
            return API.request(`/societies/address/${id}`, {
                method: 'PUT',
                body: JSON.stringify(addressData)
            });
        },
        
        async deleteAddress(id) {
            return API.request(`/societies/address/${id}`, {
                method: 'DELETE'
            });
        }
    },
    
    // Categories
    categories: {
        async getAll() {
            return API.request('/categories');
        },
        
        async getBySlug(slug) {
            return API.request(`/categories/${slug}`);
        }
    },
    
    // Products
    products: {
        async getAll(filters = {}) {
            const params = new URLSearchParams(filters);
            return API.request(`/products?${params}`);
        },
        
        async getByCategory(categorySlug) {
            return API.request(`/products/category/${categorySlug}`);
        },
        
        async getBySlug(slug) {
            return API.request(`/products/${slug}`);
        },
        
        async getFeatured() {
            return API.request('/products/featured/list');
        }
    },
    
    // Delivery Slots
    slots: {
        async getAll() {
            return API.request('/slots');
        },
        
        async getAvailable(date) {
            return API.request(`/slots/available?date=${date}`);
        }
    },
    
    // Cart
    cart: {
        async validate(items) {
            return API.request('/cart/validate', {
                method: 'POST',
                body: JSON.stringify({ items })
            });
        }
    },
    
    // Orders
    orders: {
        async create(orderData) {
            return API.request('/orders', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });
        },
        
        async getAll() {
            return API.request('/orders');
        },
        
        async getById(id) {
            return API.request(`/orders/${id}`);
        },
        
        async cancel(id) {
            return API.request(`/orders/${id}/cancel`, {
                method: 'PUT'
            });
        }
    }
};

// Make API available globally
window.API = API;
