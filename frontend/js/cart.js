// ============================================
// CART MANAGEMENT
// ============================================

class Cart {
    constructor() {
        this.items = this.load();
        this.updateUI();
    }
    
    // Load cart from local storage
    load() {
        return Utils.storage.get(CONFIG.STORAGE_KEYS.CART_DATA) || [];
    }
    
    // Save cart to local storage
    save() {
        Utils.storage.set(CONFIG.STORAGE_KEYS.CART_DATA, this.items);
        this.updateUI();
    }
    
    // Add item to cart
    addItem(product, quantity = 1) {
        const existingItem = this.items.find(item => item.product_id === product.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({
                product_id: product.id,
                name: product.name,
                price: product.price,
                discounted_price: product.discounted_price,
                discount_percentage: product.discount_percentage,
                image_url: product.image_url,
                unit: product.unit,
                quantity: quantity
            });
        }
        
        this.save();
        Utils.showToast(`${product.name} added to cart`, 'success');
    }
    
    // Update item quantity
    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.product_id === productId);
        
        if (item) {
            if (quantity <= 0) {
                this.removeItem(productId);
            } else {
                item.quantity = quantity;
                this.save();
            }
        }
    }
    
    // Remove item from cart
    removeItem(productId) {
        this.items = this.items.filter(item => item.product_id !== productId);
        this.save();
        Utils.showToast('Item removed from cart', 'info');
    }
    
    // Clear cart
    clear() {
        this.items = [];
        this.save();
    }
    
    // Get item quantity
    getQuantity(productId) {
        const item = this.items.find(item => item.product_id === productId);
        return item ? item.quantity : 0;
    }
    
    // Get total items count
    getTotalItems() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }
    
    // Calculate subtotal
    getSubtotal() {
        return this.items.reduce((sum, item) => {
            const price = item.discounted_price || item.price;
            return sum + (price * item.quantity);
        }, 0);
    }
    
    // Calculate total discount
    getTotalDiscount() {
        return this.items.reduce((sum, item) => {
            const discount = item.price * (item.discount_percentage / 100) * item.quantity;
            return sum + discount;
        }, 0);
    }
    
    // Get total amount
    getTotal() {
        return this.getSubtotal();
    }
    
    // Get cart items for order
    getOrderItems() {
        return this.items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity
        }));
    }
    
    // Update cart count badge
    updateUI() {
        const countElement = document.getElementById('cart-count');
        if (countElement) {
            countElement.textContent = this.getTotalItems();
        }
    }
    
    // Render cart items in modal
    renderCartModal() {
        const cartItemsContainer = document.getElementById('cart-items');
        
        if (this.items.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🛒</div>
                    <p>Your cart is empty</p>
                    <button class="btn btn-primary mt-2" id="close-cart">
                        Start Shopping
                    </button>
                </div>
            `;
            
            document.getElementById('checkout-btn').disabled = true;
            return;
        }
        
        cartItemsContainer.innerHTML = this.items.map(item => `
            <div class="cart-item">
                <img 
                    src="${item.image_url || '/images/placeholder.png'}" 
                    alt="${item.name}"
                    class="cart-item-image"
                >
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">
                        ${Utils.formatPrice(item.discounted_price || item.price)} / ${item.unit}
                    </div>
                </div>
                <div class="cart-item-actions">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="cart.updateQuantity(${item.product_id}, ${item.quantity - 1})">
                            −
                        </button>
                        <span class="qty-display">${item.quantity}</span>
                        <button class="qty-btn" onclick="cart.updateQuantity(${item.product_id}, ${item.quantity + 1})">
                            +
                        </button>
                    </div>
                    <button 
                        class="btn btn-sm btn-danger" 
                        onclick="cart.removeItem(${item.product_id})"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
        
        // Update summary
        document.getElementById('cart-subtotal').textContent = Utils.formatPrice(this.getSubtotal() + this.getTotalDiscount());
        document.getElementById('cart-discount').textContent = '-' + Utils.formatPrice(this.getTotalDiscount());
        document.getElementById('cart-total').textContent = Utils.formatPrice(this.getTotal());
        
        document.getElementById('checkout-btn').disabled = false;
    }
}

// Initialize cart
const cart = new Cart();
window.cart = cart;
