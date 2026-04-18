// ========================================
// AUTO-LOGIN ON PAGE LOAD
// ========================================

// ========================================
// SMART AUTO-LOGIN WITH ADDRESS CHECK
// ========================================

window.addEventListener("DOMContentLoaded", async function () {
  const isLoggedIn = localStorage.getItem("is_logged_in");
  const userId = localStorage.getItem("user_id");
  const mobile = localStorage.getItem("mobile");

  console.log("🔍 Checking session:", { isLoggedIn, userId, mobile });

  if (isLoggedIn === "true" && userId && mobile) {
    console.log("✅ Session found - Checking address...");

    // Restore user data
    window.currentUser = {
      id: userId,
      mobile: mobile,
      name: localStorage.getItem("user_name") || mobile,
    };

    // Check if user has saved address
    const hasAddress = await checkUserHasAddress(userId);

    setTimeout(() => {
      const loginScreen = document.getElementById("login-screen");
      const addressScreen = document.getElementById("address-screen");
      const mainScreen = document.getElementById("main-screen");

      if (loginScreen) loginScreen.style.display = "none";

      if (hasAddress) {
        // User has address → Go to products
        console.log("✅ Address found → Main screen");
        if (addressScreen) addressScreen.style.display = "none";
        if (mainScreen) mainScreen.style.display = "block";
      } else {
        // User needs to add address
        console.log("⚠️ No address → Address screen");
        if (mainScreen) mainScreen.style.display = "none";
        if (addressScreen) addressScreen.style.display = "block";
      }
    }, 200);
  } else {
    console.log("❌ No session - Show login");
  }
});

// Check if user has saved address
async function checkUserHasAddress(userId) {
  try {
    // Check localStorage first (fast)
    const savedAddress = localStorage.getItem("user_address");
    const savedSociety = localStorage.getItem("user_society");

    if (savedAddress && savedSociety) {
      console.log("✅ Address in localStorage");
      return true;
    }

    // Check database (via API)
    const response = await fetch(`${API_URL}/users/${userId}`);
    const data = await response.json();

    if (data.success && data.user) {
      const hasAddress = !!(
        data.user.default_address && data.user.default_society_id
      );

      if (hasAddress) {
        // Save to localStorage for faster future checks
        localStorage.setItem("user_address", data.user.default_address);
        localStorage.setItem("user_society", data.user.default_society_id);
        console.log("✅ Address in database");
      }

      return hasAddress;
    }

    return false;
  } catch (error) {
    console.error("Error checking address:", error);
    return false; // Show address screen if error
  }
}

// Logout function
function logoutUser() {
  if (confirm("Are you sure you want to logout?")) {
    console.log("🚪 Logging out...");
    localStorage.clear();
    window.location.reload();
  }
}

// ========================================
// REST OF YOUR CODE BELOW
// ========================================

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
    document.getElementById("loading-screen").style.display = "none";
    Utils.showScreen("login-screen");
  }

  async handleLogin(e) {
    e.preventDefault();
    const mobile = document.getElementById("mobile-input").value.trim();

    if (!Utils.validateMobile(mobile)) {
      Utils.showToast("Please enter valid 10-digit mobile number", "error");
      return;
    }

    try {
      const response = await API.auth.sendOTP(mobile);
      this.currentMobile = mobile;
      document.getElementById("mobile-display").textContent = mobile;

      // Show OTP in console for development
      if (response.dev_otp) {
        console.log("🔐 OTP:", response.dev_otp);
        Utils.showToast(`OTP sent! (Check console)`, "success");
      } else {
        Utils.showToast("OTP sent successfully", "success");
      }

      Utils.showScreen("otp-screen");
    } catch (error) {
      Utils.showToast(error.message || "Failed to send OTP", "error");
    }
  }

  async handleOTPVerify(e) {
    e.preventDefault();
    const otp = document.getElementById("otp-input").value.trim();

    if (!Utils.validateOTP(otp)) {
      Utils.showToast("Please enter valid 6-digit OTP", "error");
      return;
    }

    try {
      // Verify OTP
      const response = await API.auth.verifyOTP(this.currentMobile, otp);

      // ✅ SAVE SESSION DATA
      if (response && response.user) {
        localStorage.setItem("user_id", response.user.id);
        localStorage.setItem("mobile", response.user.mobile);
        localStorage.setItem(
          "user_name",
          response.user.name || this.currentMobile,
        );
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("token", response.token || "logged_in");

        // Save globally
        window.currentUser = response.user;

        console.log("✅ Session saved:", {
          user_id: response.user.id,
          mobile: response.user.mobile,
        });
      }

      Utils.showToast("Login successful!", "success");
      await this.showAddressScreen();
    } catch (error) {
      Utils.showToast(error.message || "Invalid OTP", "error");
    }
  }

  async showAddressScreen() {
    Utils.showScreen("address-screen");
    await this.loadSocieties();
  }

  async loadSocieties() {
    try {
      const response = await API.societies.getAll();
      const select = document.getElementById("society-select");

      select.innerHTML =
        '<option value="">Choose your society...</option>' +
        response.societies
          .map((s) => `<option value="${s.id}">${s.name} - ${s.area}</option>`)
          .join("");
    } catch (error) {
      Utils.showToast("Failed to load societies", "error");
    }
  }

  async handleAddressSubmit(e) {
    e.preventDefault();

    const addressData = {
      society_id: parseInt(document.getElementById("society-select").value),
      tower_no: document.getElementById("tower-input").value.trim(),
      flat_no: document.getElementById("flat-input").value.trim(),
      landmark: document.getElementById("landmark-input").value.trim(),
      is_default: true,
    };

    if (!addressData.society_id || !addressData.flat_no) {
      Utils.showToast("Please fill required fields", "error");
      return;
    }

    try {
      await API.societies.addAddress(addressData);

      // ✅ SAVE ADDRESS FLAG TO LOCALSTORAGE
      localStorage.setItem("has_address", "true");
      localStorage.setItem("user_society", addressData.society_id);
      localStorage.setItem(
        "user_address",
        `${addressData.flat_no}, ${addressData.tower_no}`,
      );

      console.log("✅ Address saved to localStorage");

      Utils.showToast("Address saved!", "success");
      await this.loadMainScreen();
    } catch (error) {
      Utils.showToast(error.message || "Failed to save address", "error");
    }
  }

  async loadMainScreen() {
    Utils.showScreen("main-screen");
    await this.loadCategories();
    await this.loadProducts();
  }

  async loadCategories() {
    try {
      const response = await API.categories.getAll();
      this.categories = response.categories;
      this.renderCategories();
    } catch (error) {
      Utils.showToast("Failed to load categories", "error");
    }
  }

  renderCategories() {
    const container = document.getElementById("categories-container");
    container.innerHTML = `
            <button class="category-btn active" data-category="all">All</button>
            ${this.categories
              .map(
                (cat) =>
                  `<button class="category-btn" data-category="${cat.slug}">${cat.name}</button>`,
              )
              .join("")}
        `;
  }

  async loadProducts(categorySlug = null) {
    try {
      let response;
      if (categorySlug && categorySlug !== "all") {
        response = await API.products.getByCategory(categorySlug);
      } else {
        response = await API.products.getAll();
      }

      this.products = response.products;
      this.renderProducts();
    } catch (error) {
      Utils.showToast("Failed to load products", "error");
    }
  }

  renderProducts(searchTerm = "") {
    const container = document.getElementById("products-container");

    let filteredProducts = this.products;
    if (searchTerm) {
      filteredProducts = this.products.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (filteredProducts.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><p>No products found</p></div>';
      return;
    }

    container.innerHTML = filteredProducts
      .map((product) => {
        const quantity = cart.getQuantity(product.id);
        const hasDiscount = product.discount_percentage > 0;

        return `
                <div class="product-card">
                    <img 
                        src="${product.image_url || "/images/placeholder.png"}" 
                        alt="${product.name}"
                        class="product-image"
                    >
                    <div class="product-info">
                        <div class="product-name">${product.name}</div>
                        <div class="product-price">
                            <span class="price-current">${Utils.formatPrice(product.discounted_price)}</span>
                            ${
                              hasDiscount
                                ? `
                                <span class="price-original">${Utils.formatPrice(product.price)}</span>
                                <span class="discount-badge">${product.discount_percentage}% OFF</span>
                            `
                                : ""
                            }
                        </div>
                        <div class="product-unit">per ${product.unit}</div>
                        <div class="product-actions">
                            ${
                              quantity > 0
                                ? `
                                <div class="qty-controls">
                                    <button class="qty-btn" onclick="app.updateCart(${product.id}, -1)">−</button>
                                    <span class="qty-display">${quantity}</span>
                                    <button class="qty-btn" onclick="app.updateCart(${product.id}, 1)">+</button>
                                </div>
                            `
                                : `
                                <button class="add-to-cart-btn" onclick="app.addToCart(${product.id})">
                                    Add to Cart
                                </button>
                            `
                            }
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  addToCart(productId) {
    const product = this.products.find((p) => p.id === productId);
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
    Utils.showModal("cart-modal");
  }

  async showCheckoutModal() {
    Utils.hideModal("cart-modal");
    Utils.showModal("checkout-modal");

    // Set minimum date to tomorrow
    const dateInput = document.getElementById("delivery-date");
    dateInput.min = Utils.getTomorrowDate();
    dateInput.value = Utils.getTomorrowDate();

    await this.loadDeliverySlots(Utils.getTomorrowDate());

    // Update final total
    document.getElementById("final-total").textContent = Utils.formatPrice(
      cart.getTotal(),
    );
  }

  async loadDeliverySlots(date) {
    try {
      const response = await API.slots.getAvailable(date);
      const container = document.getElementById("slots-container");

      if (response.slots.length === 0) {
        container.innerHTML = "<p>No slots available for this date</p>";
        return;
      }

      container.innerHTML = response.slots
        .map(
          (slot, index) => `
                <div class="slot-option ${index === 0 ? "selected" : ""}" 
                     data-slot-id="${slot.id}"
                     onclick="app.selectSlot(${slot.id})">
                    ${Utils.formatTime(slot.slot_start)} - ${Utils.formatTime(slot.slot_end)}
                    <small>(${slot.available_slots} slots available)</small>
                </div>
            `,
        )
        .join("");

      this.selectedSlot = response.slots[0].id;
    } catch (error) {
      Utils.showToast("Failed to load delivery slots", "error");
    }
  }

  selectSlot(slotId) {
    this.selectedSlot = slotId;
    document.querySelectorAll(".slot-option").forEach((el) => {
      el.classList.remove("selected");
    });
    document
      .querySelector(`[data-slot-id="${slotId}"]`)
      .classList.add("selected");
  }

  async placeOrder() {
    if (!this.selectedSlot) {
      Utils.showToast("Please select a delivery slot", "error");
      return;
    }

    const deliveryDate = document.getElementById("delivery-date").value;
    const paymentMethod = document.querySelector(
      'input[name="payment"]:checked',
    ).value;
    const addresses = await API.societies.getMyAddresses();

    if (!addresses.addresses || addresses.addresses.length === 0) {
      Utils.showToast("No delivery address found", "error");
      return;
    }

    const orderData = {
      address_id: addresses.addresses[0].id,
      delivery_slot_id: this.selectedSlot,
      delivery_date: deliveryDate,
      items: cart.getOrderItems(),
      payment_method: paymentMethod,
    };

    try {
      const response = await API.orders.create(orderData);

      Utils.showToast("Order placed successfully! 🎉", "success");
      Utils.hideModal("checkout-modal");
      cart.clear();
      this.renderProducts();

      // Show order confirmation
      alert(
        `Order #${response.order.order_number} placed!\nTotal: ${Utils.formatPrice(response.order.total_amount)}`,
      );
    } catch (error) {
      Utils.showToast(error.message || "Failed to place order", "error");
    }
  }

  setupEventListeners() {
    // Login form
    document
      .getElementById("login-form")
      ?.addEventListener("submit", (e) => this.handleLogin(e));

    // OTP form
    document
      .getElementById("otp-form")
      ?.addEventListener("submit", (e) => this.handleOTPVerify(e));
    document.getElementById("resend-otp")?.addEventListener("click", () => {
      if (this.currentMobile) {
        API.auth.sendOTP(this.currentMobile);
        Utils.showToast("OTP resent", "success");
      }
    });

    // Address form
    document
      .getElementById("address-form")
      ?.addEventListener("submit", (e) => this.handleAddressSubmit(e));

    // Cart button
    document
      .getElementById("cart-btn")
      ?.addEventListener("click", () => this.showCartModal());

    // Close cart modal
    document
      .getElementById("close-cart")
      ?.addEventListener("click", () => Utils.hideModal("cart-modal"));

    // Checkout button
    document
      .getElementById("checkout-btn")
      ?.addEventListener("click", () => this.showCheckoutModal());

    // Close checkout modal
    document
      .getElementById("close-checkout")
      ?.addEventListener("click", () => Utils.hideModal("checkout-modal"));

    // Place order button
    document
      .getElementById("place-order-btn")
      ?.addEventListener("click", () => this.placeOrder());

    // Date change
    document
      .getElementById("delivery-date")
      ?.addEventListener("change", (e) => {
        this.loadDeliverySlots(e.target.value);
      });

    // Category buttons
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("category-btn")) {
        document
          .querySelectorAll(".category-btn")
          .forEach((btn) => btn.classList.remove("active"));
        e.target.classList.add("active");
        this.loadProducts(e.target.dataset.category);
      }
    });

    // Search
    const searchDebounced = Utils.debounce(
      (term) => this.renderProducts(term),
      300,
    );
    document.getElementById("search-input")?.addEventListener("input", (e) => {
      searchDebounced(e.target.value);
    });

    // Close modals on backdrop click
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("show");
        }
      });
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});

function getStockBadge(quantity) {
  if (quantity === 0) {
    return '<span class="stock-badge sold-out">SOLD OUT</span>';
  } else if (quantity < 10) {
    return `<span class="stock-badge low-stock">Only ${quantity} left!</span>`;
  }
  return '<span class="stock-badge in-stock">In Stock</span>';
}

function renderProductCard(product) {
  // Image URL with fallback
  const imageUrl =
    product.image_url || "https://via.placeholder.com/300x200?text=No+Image";

  // Stock status
  const stock = product.stock_quantity;
  let stockBadge, isOutOfStock, stockClass;

  if (stock === 0) {
    stockBadge = '<span class="stock-badge sold-out">❌ SOLD OUT</span>';
    isOutOfStock = true;
    stockClass = "out-of-stock";
  } else if (stock < 10) {
    stockBadge = `<span class="stock-badge low-stock">⚠️ Only ${stock} left!</span>`;
    isOutOfStock = false;
    stockClass = "low-stock";
  } else {
    stockBadge = '<span class="stock-badge in-stock">✅ In Stock</span>';
    isOutOfStock = false;
    stockClass = "in-stock";
  }

  // Price calculation
  const hasDiscount = product.discount_percentage > 0;
  const discountedPrice = hasDiscount
    ? (
        product.price -
        (product.price * product.discount_percentage) / 100
      ).toFixed(2)
    : product.price;

  return `
        <div class="product-card ${stockClass}" data-product-id="${product.id}">
            <img 
                src="${imageUrl}" 
                alt="${product.name}" 
                class="product-image"
                onerror="this.src='https://via.placeholder.com/300x200?text=Product+Image'"
            >
            <h3 class="product-name">${product.name}</h3>
            
            <div class="price-section">
                ${
                  hasDiscount
                    ? `
                    <span class="product-price">₹${discountedPrice}</span>
                    <span class="original-price">₹${product.price}</span>
                    <span class="discount-badge">${product.discount_percentage}% OFF</span>
                `
                    : `
                    <span class="product-price">₹${product.price}</span>
                `
                }
                <span class="product-unit">per ${product.unit}</span>
            </div>
            
            ${stockBadge}
            
            ${
              !isOutOfStock
                ? `
                <div class="quantity-controls">
                    <button class="qty-btn minus" onclick="decreaseQty(${product.id})">−</button>
                    <input 
                        type="number" 
                        id="qty-${product.id}" 
                        class="qty-input" 
                        value="1" 
                        min="0.5" 
                        step="0.5"
                    >
                    <button class="qty-btn plus" onclick="increaseQty(${product.id})">+</button>
                </div>
                <button class="add-to-cart" onclick="addToCart(${product.id})">
                    🛒 Add to Cart
                </button>
            `
                : `
                <button class="add-to-cart" disabled>
                    Sold Out
                </button>
            `
            }
        </div>
    `;
}

// Quantity increase
function increaseQty(productId) {
  const input = document.getElementById(`qty-${productId}`);
  const currentValue = parseFloat(input.value) || 0;
  const step = parseFloat(input.step) || 1;
  input.value = (currentValue + step).toFixed(1);
}

// Quantity decrease
function decreaseQty(productId) {
  const input = document.getElementById(`qty-${productId}`);
  const currentValue = parseFloat(input.value) || 0;
  const step = parseFloat(input.step) || 1;
  const min = parseFloat(input.min) || 1;
  const newValue = currentValue - step;
  if (newValue >= min) {
    input.value = newValue.toFixed(1);
  }
}

// ========================================
// PAGE NAVIGATION SYSTEM
// ========================================

function switchPage(pageName) {
  // Hide all pages
  document.querySelectorAll(".page").forEach((page) => {
    page.style.display = "none";
    page.classList.remove("active");
  });

  // Show selected page
  const selectedPage = document.getElementById(`page-${pageName}`);
  if (selectedPage) {
    selectedPage.style.display = "block";
    selectedPage.classList.add("active");
  }

  // Update active nav button
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("active");
  });
  const activeNav = document.getElementById(`nav-${pageName}`);
  if (activeNav) {
    activeNav.classList.add("active");
  }

  // Load page content
  switch (pageName) {
    case "home":
      // Products already loaded
      break;
    case "orders":
      loadUserOrders();
      break;
    case "profile":
      loadUserProfile();
      break;
  }
}

// ========================================
// LOAD USER ORDERS
// ========================================

async function loadUserOrders() {
  const userId = localStorage.getItem("user_id");
  const ordersList = document.getElementById("orders-list");

  if (!userId) {
    ordersList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <p style="font-size: 48px; margin-bottom: 20px;">📦</p>
                <h3 style="color: #666;">Please login to view orders</h3>
            </div>
        `;
    return;
  }

  ordersList.innerHTML =
    '<p style="text-align: center; padding: 40px;">Loading orders...</p>';

  try {
    const response = await fetch(
      `${API_URL}/orders/my-orders?user_id=${userId}`,
    );
    const data = await response.json();

    if (data.success && data.orders && data.orders.length > 0) {
      renderOrders(data.orders);
    } else {
      ordersList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <p style="font-size: 48px; margin-bottom: 20px;">📦</p>
                    <h3 style="color: #666;">No orders yet</h3>
                    <p style="color: #999; margin-top: 10px;">Start shopping to see your orders here!</p>
                    <button onclick="switchPage('home')" style="margin-top: 20px; padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Browse Products
                    </button>
                </div>
            `;
    }
  } catch (error) {
    console.error("Error loading orders:", error);
    ordersList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <p style="font-size: 48px; margin-bottom: 20px;">⚠️</p>
                <h3 style="color: #666;">Error loading orders</h3>
                <p style="color: #999; margin-top: 10px;">Please try again later</p>
            </div>
        `;
  }
}

// ========================================
// RENDER ORDERS
// ========================================

function renderOrders(orders) {
  const html = orders
    .map((order) => {
      const statusColors = {
        pending: "#f59e0b",
        confirmed: "#3b82f6",
        preparing: "#8b5cf6",
        out_for_delivery: "#06b6d4",
        delivered: "#10b981",
        cancelled: "#ef4444",
      };

      const statusColor = statusColors[order.order_status] || "#6b7280";

      return `
            <div class="order-card" style="background: white; padding: 20px; margin-bottom: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <h3 style="margin: 0; font-size: 16px; color: #333;">Order #${order.order_number}</h3>
                        <p style="margin: 5px 0 0 0; color: #999; font-size: 14px;">
                            ${new Date(order.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                        </p>
                    </div>
                    <span style="background: ${statusColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: capitalize;">
                        ${order.order_status.replace("_", " ")}
                    </span>
                </div>
                
                <div style="border-top: 1px solid #f0f0f0; padding-top: 15px; margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Items:</span>
                        <span style="font-weight: 600;">${order.items ? order.items.length : 0} items</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Payment:</span>
                        <span style="font-weight: 600; text-transform: capitalize;">${order.payment_method}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                        <span style="color: #666; font-weight: 600;">Total Amount:</span>
                        <span style="font-size: 20px; font-weight: 700; color: #10b981;">₹${order.total_amount}</span>
                    </div>
                </div>
            </div>
        `;
    })
    .join("");

  document.getElementById("orders-list").innerHTML = html;
}

// ========================================
// LOAD USER PROFILE
// ========================================

function loadUserProfile() {
  const userId = localStorage.getItem("user_id");
  const mobile = localStorage.getItem("mobile");
  const name = localStorage.getItem("user_name") || "Guest User";
  const profileContent = document.getElementById("profile-content");

  if (!userId) {
    profileContent.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <p style="font-size: 48px; margin-bottom: 20px;">👤</p>
                <h3 style="color: #666;">Please login first</h3>
            </div>
        `;
    return;
  }

  const html = `
        <div class="profile-card" style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; font-size: 36px;">
                    👤
                </div>
                <h2 style="margin: 0; color: #333;">${name}</h2>
            </div>
            
            <div style="margin: 20px 0;">
                <div style="padding: 15px; background: #f9fafb; border-radius: 8px; margin-bottom: 12px;">
                    <p style="margin: 0; color: #666; font-size: 12px; margin-bottom: 4px;">Mobile Number</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">📱 ${mobile}</p>
                </div>
                
                <div style="padding: 15px; background: #f9fafb; border-radius: 8px; margin-bottom: 12px;">
                    <p style="margin: 0; color: #666; font-size: 12px; margin-bottom: 4px;">User ID</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">#${userId}</p>
                </div>
            </div>
            
            <button onclick="logoutUser()" style="width: 100%; padding: 15px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 20px;">
                🚪 Logout
            </button>
        </div>
    `;

  profileContent.innerHTML = html;
}

// ========================================
// LOGOUT FUNCTION
// ========================================

function logoutUser() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.clear();
    window.location.reload();
  }
}
