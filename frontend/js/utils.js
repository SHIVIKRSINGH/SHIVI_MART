// ============================================
// UTILITY FUNCTIONS
// ============================================

const Utils = {
    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.SETTINGS.TOAST_DURATION);
    },
    
    // Format price
    formatPrice(price) {
        return `₹${parseFloat(price).toFixed(2)}`;
    },
    
    // Calculate discounted price
    calculateDiscount(price, discountPercent) {
        return price - (price * discountPercent / 100);
    },
    
    // Format date
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    },
    
    // Format time
    formatTime(time) {
        return new Date(`2000-01-01 ${time}`).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    },
    
    // Validate mobile number
    validateMobile(mobile) {
        return /^[6-9]\d{9}$/.test(mobile);
    },
    
    // Validate OTP
    validateOTP(otp) {
        return /^\d{6}$/.test(otp);
    },
    
    // Get tomorrow's date
    getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    },
    
    // Local Storage helpers
    storage: {
        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },
        
        get(key) {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        },
        
        remove(key) {
            localStorage.removeItem(key);
        },
        
        clear() {
            localStorage.clear();
        }
    },
    
    // Show/Hide screens
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });
        
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.style.display = 'block';
        }
    },
    
    // Show/Hide modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    },
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    },
    
    // Debounce function for search
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Generate slug from text
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '');
    }
};

// Make Utils available globally
window.Utils = Utils;
