// ============================================
// MAIN APPLICATION
// ============================================

class App {
    constructor() {
        this.currentMobile = null;
        this.categories = [];
        this.products = [];
        this.selectedSlot = null;
        this.init();
    }
    
    async init() {
        // Check authentication
        const token = API.getAuthToken();
        const savedAddress = Utils.storage.get(CONFIG.STORAGE_KEYS.ADDRESS_DATA);
        
        if (token && savedAddress) {
            await this.loadMainScreen();
        } else if (token && !savedAddress) {
            await this.showAddressScreen();
        } else {
            this.showLoginScreen();
        }
        
        this.setupEventListeners();
    }
    
    showLoginScreen() {
        document.getElementById('loading-screen').style.display = 'none';
        Utils.showScreen('login-screen');
    }
    
    async handleLogin(e) {
        e.preventDefault();
        const mobile = document.getElementById('mobile-input').value.trim();
        
        if (!Utils.validateMobile(mobile)) {
            Utils.showToast('Please enter valid 10-digit mobile number', 'error');
            return;
        }
        
        try {
            const response = await API.auth.sendOTP(mobile);
            this.currentMobile = mobile;
            document.getElementById('mobile-display').textContent = mobile;
            
            // Show OTP in console for development
            if (response.dev_otp) {
                console.log('🔐 OTP:', response.dev_otp);
                Utils.showToast(`OTP sent! (Check console)`, 'success');
            } else {
                Utils.showToast('OTP sent successfully', 'success');
            }
            
            Utils.showScreen('otp-screen');
        } catch (error) {
            Utils.showToast(error.message || 'Failed to send OTP', 'error');
        }
    }
    
    async handleOTPVerify(e) {
        e.preventDefault();
        const otp = document.getElementById('otp-input').value.trim();
        
        if (!Utils.validateOTP(otp)) {
            Utils.showToast('Please enter valid 6-digit OTP', 'error');
            return;
        }
        
        try {
            await API.auth.verifyOTP(this.currentMobile, otp);
            Utils.showToast('Login successful!', 'success');
            await this.showAddressScreen();
        } catch (error) {
            Utils.showToast(error.message || 'Invalid OTP', 'error');
        }
    }
    
    async showAddressScreen() {
        Utils.showScreen('address-screen');
        await this.loadSocieties();
    }
    
    async loadSocieties() {
        try {
            const response = await API.societies.getAll();
            const select = document.getElementById('society-select');
            
            select.innerHTML = '<option value="">Choose your society...</option>' +
                response.societies.map(s => 
                    `<option value="${s.id}">${s.name} - ${s.area}</option>`
                ).join('');
        } catch (error) {
            Utils.showToast('Failed to load societies', 'error');
        }
    }
    
    async handleAddressSubmit(e) {
        e.preventDefault();
        
        const addressData = {
            society_id: parseInt(document.getElementById('society-select').value),
            tower_no: document.getElementById('tower-input').value.trim(),
            flat_no: document.getElementById('flat-input').value.trim(),
            landmark: document.getElementById('landmark-input').value.trim(),
            is_default: true
        };
        
        if (!addressData.society_id || !addressData.flat_no) {
            Utils.showToast('Please fill required fields', 'error');
            return;
        }
        
        try {
            await API.societies.addAddress(addressData);
            Utils.showToast('Address saved!', 'success');
            await this.loadMainScreen();
        } catch (error) {
            Utils.showToast(error.message || 'Failed to save address', 'error');
        }
    }
    
    async loadMainScreen() {
        Utils.showScreen('main-screen');
        await this.loadCategories();
        await this.loadProducts();
    }
    
    async loadCategories() {
        try {
            const response = await API.categories.getAll();
            this.categories = response.categories;
            this.renderCategories();
        } catch (error) {
            Utils.showToast('Failed to load categories', 'error');
        }
    }
    
    renderCategories() {
        const container = document.getElementById('categories-container');
        container.innerHTML = `
            <button class="category-btn active" data-category="all">All</button>
            ${this.categories.map(cat => 
                `<button class="category-btn" data-category="${cat.slug}">${cat.name}</button>`
            ).join('')}
        `;
    }
    
    async loadProducts(categorySlug = null) {
        try {
            let response;
            if (categorySlug && categorySlug !== 'all') {
                response = await API.products.getByCategory(categorySlug);
            } else {
                response = await API.products.getAll();
            }
            
            this.products = response.products;
            this.renderProducts();
        } catch (error) {
            Utils.showToast('Failed to load products', 'error');
        }
    }
    
    renderProducts(searchTerm = '') {
        const container = document.getElementById('products-container');
        
        let filteredProducts = this.products;
        if (searchTerm) {
            filteredProducts = this.products.filter(p => 
                p.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (filteredProducts.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No products found</p></div>';
            return;
        }
        
        container.innerHTML = filteredProducts.map(product => {
            const quantity = cart.getQuantity(product.id);
            const hasDiscount = product.discount_percentage > 0;
            
            return `
                <div class="product-card">
                    <img 
                        src="${product.image_url || '/images/placeholder.png'}" 
                        alt="${product.name}"
                        class="product-image"
                    >
                    <div class="product-info">
                        <div class="product-name">${product.name}</div>
                        <div class="product-price">
                            <span class="price-current">${Utils.formatPrice(product.discounted_price)}</span>
                            ${hasDiscount ? `
                                <span class="price-original">${Utils.formatPrice(product.price)}</span>
                                <span class="discount-badge">${product.discount_percentage}% OFF</span>
                            ` : ''}
                        </div>
                        <div class="product-unit">per ${product.unit}</div>
                        <div class="product-actions">
                            ${quantity > 0 ? `
                                <div class="qty-controls">
                                    <button class="qty-btn" onclick="app.updateCart(${product.id}, -1)">−</button>
                                    <span class="qty-display">${quantity}</span>
                                    <button class="qty-btn" onclick="app.updateCart(${product.id}, 1)">+</button>
                                </div>
                            ` : `
                                <button class="add-to-cart-btn" onclick="app.addToCart(${product.id})">
                                    Add to Cart
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            cart.addItem(product);
            this.renderProducts(); // Re-render to show quantity controls
        }
    }
    
    updateCart(productId, change) {
        const currentQty = cart.getQuantity(productId);
        cart.updateQuantity(productId, currentQty + change);
        this.renderProducts();
    }
    
    showCartModal() {
        cart.renderCartModal();
        Utils.showModal('cart-modal');
    }
    
    async showCheckoutModal() {
        Utils.hideModal('cart-modal');
        Utils.showModal('checkout-modal');
        
        // Set minimum date to tomorrow
        const dateInput = document.getElementById('delivery-date');
        dateInput.min = Utils.getTomorrowDate();
        dateInput.value = Utils.getTomorrowDate();
        
        await this.loadDeliverySlots(Utils.getTomorrowDate());
        
        // Update final total
        document.getElementById('final-total').textContent = Utils.formatPrice(cart.getTotal());
    }
    
    async loadDeliverySlots(date) {
        try {
            const response = await API.slots.getAvailable(date);
            const container = document.getElementById('slots-container');
            
            if (response.slots.length === 0) {
                container.innerHTML = '<p>No slots available for this date</p>';
                return;
            }
            
            container.innerHTML = response.slots.map((slot, index) => `
                <div class="slot-option ${index === 0 ? 'selected' : ''}" 
                     data-slot-id="${slot.id}"
                     onclick="app.selectSlot(${slot.id})">
                    ${Utils.formatTime(slot.slot_start)} - ${Utils.formatTime(slot.slot_end)}
                    <small>(${slot.available_slots} slots available)</small>
                </div>
            `).join('');
            
            this.selectedSlot = response.slots[0].id;
        } catch (error) {
            Utils.showToast('Failed to load delivery slots', 'error');
        }
    }
    
    selectSlot(slotId) {
        this.selectedSlot = slotId;
        document.querySelectorAll('.slot-option').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelector(`[data-slot-id="${slotId}"]`).classList.add('selected');
    }
    
    async placeOrder() {
        if (!this.selectedSlot) {
            Utils.showToast('Please select a delivery slot', 'error');
            return;
        }
        
        const deliveryDate = document.getElementById('delivery-date').value;
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        const addresses = await API.societies.getMyAddresses();
        
        if (!addresses.addresses || addresses.addresses.length === 0) {
            Utils.showToast('No delivery address found', 'error');
            return;
        }
        
        const orderData = {
            address_id: addresses.addresses[0].id,
            delivery_slot_id: this.selectedSlot,
            delivery_date: deliveryDate,
            items: cart.getOrderItems(),
            payment_method: paymentMethod
        };
        
        try {
            const response = await API.orders.create(orderData);
            
            Utils.showToast('Order placed successfully! 🎉', 'success');
            Utils.hideModal('checkout-modal');
            cart.clear();
            this.renderProducts();
            
            // Show order confirmation
            alert(`Order #${response.order.order_number} placed!\nTotal: ${Utils.formatPrice(response.order.total_amount)}`);
        } catch (error) {
            Utils.showToast(error.message || 'Failed to place order', 'error');
        }
    }
    
    setupEventListeners() {
        // Login form
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
        
        // OTP form
        document.getElementById('otp-form')?.addEventListener('submit', (e) => this.handleOTPVerify(e));
        document.getElementById('resend-otp')?.addEventListener('click', () => {
            if (this.currentMobile) {
                API.auth.sendOTP(this.currentMobile);
                Utils.showToast('OTP resent', 'success');
            }
        });
        
        // Address form
        document.getElementById('address-form')?.addEventListener('submit', (e) => this.handleAddressSubmit(e));
        
        // Cart button
        document.getElementById('cart-btn')?.addEventListener('click', () => this.showCartModal());
        
        // Close cart modal
        document.getElementById('close-cart')?.addEventListener('click', () => Utils.hideModal('cart-modal'));
        
        // Checkout button
        document.getElementById('checkout-btn')?.addEventListener('click', () => this.showCheckoutModal());
        
        // Close checkout modal
        document.getElementById('close-checkout')?.addEventListener('click', () => Utils.hideModal('checkout-modal'));
        
        // Place order button
        document.getElementById('place-order-btn')?.addEventListener('click', () => this.placeOrder());
        
        // Date change
        document.getElementById('delivery-date')?.addEventListener('change', (e) => {
            this.loadDeliverySlots(e.target.value);
        });
        
        // Category buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.loadProducts(e.target.dataset.category);
            }
        });
        
        // Search
        const searchDebounced = Utils.debounce((term) => this.renderProducts(term), 300);
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            searchDebounced(e.target.value);
        });
        
        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
