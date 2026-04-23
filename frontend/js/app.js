// ============================================
// SHIVIMART APP.JS - FINAL VERSION
// Database-based session with proper authentication
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
    console.log("🚀 ShiviMart Initializing...");

    // Check for authentication token
    const token = Utils.storage.get(CONFIG.STORAGE_KEYS.AUTH_TOKEN);

    if (token) {
      console.log("✅ Token found, verifying session...");

      try {
        // Verify token and get user profile from database
        const profile = await API.auth.getProfile();
        console.log("✅ User profile loaded:", profile.user.mobile);

        // Check if user has saved addresses in database
        const addresses = await API.societies.getMyAddresses();

        if (
          addresses &&
          addresses.addresses &&
          addresses.addresses.length > 0
        ) {
          console.log("✅ User has address in database");
          // Save to localStorage for quick access
          Utils.storage.set(
            CONFIG.STORAGE_KEYS.ADDRESS_DATA,
            addresses.addresses[0],
          );
          await this.loadMainScreen();
        } else {
          console.log("⚠️ No address found - showing address form");
          await this.showAddressScreen();
        }
      } catch (error) {
        console.error("❌ Session verification failed:", error);
        // Token invalid or expired
        this.clearSessionAndShowLogin();
      }
    } else {
      console.log("ℹ️ No token found - showing login");
      this.showLoginScreen();
    }

    this.setupEventListeners();

    // Hide loading screen
    document.getElementById("loading-screen").style.display = "none";
  }

  clearSessionAndShowLogin() {
    Utils.storage.clear();
    this.showLoginScreen();
  }

  showLoginScreen() {
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
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Sending...";

      const response = await API.auth.sendOTP(mobile);
      this.currentMobile = mobile;
      document.getElementById("mobile-display").textContent = mobile;

      // Show OTP in console for development
      if (response.dev_otp) {
        console.log("🔐 Development OTP:", response.dev_otp);
        Utils.showToast(`OTP sent! (Dev OTP: ${response.dev_otp})`, "success");
      } else {
        Utils.showToast("OTP sent successfully", "success");
      }

      Utils.showScreen("otp-screen");
      document.getElementById("otp-input").focus();

      btn.disabled = false;
      btn.textContent = "Send OTP";
    } catch (error) {
      console.error("Login error:", error);
      Utils.showToast(error.message || "Failed to send OTP", "error");
      e.target.querySelector('button[type="submit"]').disabled = false;
      e.target.querySelector('button[type="submit"]').textContent = "Send OTP";
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
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Verifying...";

      // Verify OTP - this saves token via API.auth.verifyOTP
      const response = await API.auth.verifyOTP(this.currentMobile, otp);

      console.log("✅ OTP verified successfully");
      console.log(
        "✅ Token saved:",
        Utils.storage.get(CONFIG.STORAGE_KEYS.AUTH_TOKEN),
      );

      Utils.showToast("Login successful!", "success");

      // Check if user has addresses in database
      try {
        const addresses = await API.societies.getMyAddresses();

        if (
          addresses &&
          addresses.addresses &&
          addresses.addresses.length > 0
        ) {
          console.log("✅ User has existing address");
          Utils.storage.set(
            CONFIG.STORAGE_KEYS.ADDRESS_DATA,
            addresses.addresses[0],
          );
          await this.loadMainScreen();
        } else {
          console.log("⚠️ User needs to add address");
          await this.showAddressScreen();
        }
      } catch (error) {
        console.log("⚠️ No addresses found, showing address form");
        await this.showAddressScreen();
      }

      btn.disabled = false;
      btn.textContent = "Verify & Login";
    } catch (error) {
      console.error("OTP verification error:", error);
      Utils.showToast(error.message || "Invalid OTP", "error");
      e.target.querySelector('button[type="submit"]').disabled = false;
      e.target.querySelector('button[type="submit"]').textContent =
        "Verify & Login";
    }
  }

  async showAddressScreen() {
    Utils.showScreen("address-screen");
    await this.loadSocieties();
  }

  async loadSocieties() {
    try {
      const response = await API.societies.getAll();

      // Handle different response formats
      let societies = [];
      if (Array.isArray(response)) {
        societies = response;
      } else if (response.societies && Array.isArray(response.societies)) {
        societies = response.societies;
      }

      const select = document.getElementById("society-select");

      if (societies.length === 0) {
        select.innerHTML = '<option value="">No societies available</option>';
        Utils.showToast(
          "No societies available. Please contact admin.",
          "error",
        );
        return;
      }

      select.innerHTML =
        '<option value="">Choose your society...</option>' +
        societies
          .map(
            (s) =>
              `<option value="${s.id}">${s.name}${s.area ? " - " + s.area : ""}</option>`,
          )
          .join("");

      console.log("✅ Societies loaded:", societies.length);
    } catch (error) {
      console.error("Failed to load societies:", error);
      Utils.showToast("Failed to load societies", "error");
    }
  }

  // async handleAddressSubmit(e) {
  //   e.preventDefault();

  //   const addressData = {
  //     society_id: parseInt(document.getElementById("society-select").value),
  //     tower_no: document.getElementById("tower-input").value.trim() || null,
  //     flat_no: document.getElementById("flat-input").value.trim(),
  //     landmark: document.getElementById("landmark-input").value.trim() || null,
  //     is_default: true,
  //   };

  //   if (!addressData.society_id || !addressData.flat_no) {
  //     Utils.showToast("Please fill required fields", "error");
  //     return;
  //   }

  //   try {
  //     const btn = e.target.querySelector('button[type="submit"]');
  //     btn.disabled = true;
  //     btn.textContent = "Saving...";

  //     // Save to database - uses token automatically
  //     await API.societies.addAddress(addressData);

  //     console.log("✅ Address saved to database");

  //     Utils.showToast("Address saved!", "success");
  //     await this.loadMainScreen();

  //     btn.disabled = false;
  //     btn.textContent = "Continue Shopping";
  //   } catch (error) {
  //     console.error("Address save error:", error);
  //     Utils.showToast(error.message || "Failed to save address", "error");
  //     e.target.querySelector('button[type="submit"]').disabled = false;
  //     e.target.querySelector('button[type="submit"]').textContent =
  //       "Continue Shopping";
  //   }
  // }
  async handleAddressSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("name-input").value.trim();

    const addressData = {
      society_id: parseInt(document.getElementById("society-select").value),
      tower_no: document.getElementById("tower-input").value.trim() || null,
      flat_no: document.getElementById("flat-input").value.trim(),
      landmark: document.getElementById("landmark-input").value.trim() || null,
      is_default: true,
    };

    if (!name || !addressData.society_id || !addressData.flat_no) {
      Utils.showToast("Please fill all required fields", "error");
      return;
    }

    try {
      await API.societies.addAddress(addressData);

      // ✅ SAVE NAME + ADDRESS IN USERS TABLE
      const fullAddress = `Flat ${addressData.flat_no}, Tower ${addressData.tower_no || ""}`;

      await API.request("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: name,
          address: fullAddress,
        }),
      });

      Utils.showToast("Profile saved!", "success");
      await this.loadMainScreen();
    } catch (error) {
      console.error(error);
      Utils.showToast(error.message || "Failed to save", "error");
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
      this.categories = response.categories || [];
      this.renderCategories();
    } catch (error) {
      console.error("Failed to load categories:", error);
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

    // Add click handlers
    container.querySelectorAll(".category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        container
          .querySelectorAll(".category-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const category = btn.dataset.category;
        this.loadProducts(category);
      });
    });
  }

  async loadProducts(categorySlug = null) {
    try {
      let response;
      if (categorySlug && categorySlug !== "all") {
        response = await API.products.getByCategory(categorySlug);
      } else {
        response = await API.products.getAll();
      }

      this.products = response.products || [];
      this.renderProducts();
    } catch (error) {
      console.error("Failed to load products:", error);
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
        const outOfStock = product.stock_quantity <= 0;
        const lowStock =
          product.stock_quantity > 0 && product.stock_quantity < 10;

        let stockBadge = "";
        if (outOfStock) {
          stockBadge = '<div class="stock-badge sold-out">SOLD OUT</div>';
        } else if (lowStock) {
          stockBadge = `<div class="stock-badge low-stock">Only ${product.stock_quantity} left</div>`;
        }

        return `
                <div class="product-card ${outOfStock ? "out-of-stock" : ""}">
                    ${stockBadge}
                    <img 
                        src="${product.image_url || "/images/placeholder.png"}" 
                        alt="${product.name}"
                        class="product-image"
                        onerror="this.src='/images/placeholder.png'"
                    >
                    <div class="product-info">
                        <div class="product-name">${product.name}</div>
                        <div class="product-price">
                            <span class="price-current">${Utils.formatPrice(product.discounted_price || product.price)}</span>
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
                                    <button class="qty-btn" onclick="app.updateCart(${product.id}, 1)" 
                                        ${quantity >= product.stock_quantity ? "disabled" : ""}>+</button>
                                </div>
                            `
                                : `
                                <button class="add-to-cart-btn" onclick="app.addToCart(${product.id})"
                                    ${outOfStock ? "disabled" : ""}>
                                    ${outOfStock ? "Out of Stock" : "Add to Cart"}
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
    if (product && product.stock_quantity > 0) {
      cart.addItem(product);
      this.renderProducts();
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

  // async showCheckoutModal() {
  //   Utils.hideModal("cart-modal");
  //   Utils.showModal("checkout-modal");

  //   const dateInput = document.getElementById("delivery-date");
  //   dateInput.min = Utils.getTomorrowDate();
  //   dateInput.value = Utils.getTomorrowDate();

  //   await this.loadDeliverySlots(Utils.getTomorrowDate());

  //   document.getElementById("final-total").textContent = Utils.formatPrice(
  //     cart.getTotal(),
  //   );
  // }

  async showCheckoutModal() {
    Utils.hideModal("cart-modal");
    Utils.showModal("checkout-modal");

    try {
      const profile = await API.auth.getProfile();

      document.getElementById("checkout-name").value =
        profile.user.name || "Guest";

      document.getElementById("checkout-address").value =
        profile.user.default_address || "No address";
    } catch (err) {
      Utils.showToast("Failed to load profile", "error");
    }

    document.getElementById("final-total").textContent = Utils.formatPrice(
      cart.getTotal(),
    );

    const dateInput = document.getElementById("delivery-date");
    dateInput.min = Utils.getTodayDate();
    dateInput.value = Utils.getTodayDate();

    await this.loadDeliverySlots(dateInput.value);
  }

  // async loadDeliverySlots(date) {
  //   try {
  //     const response = await API.slots.getAvailable(date);
  //     const container = document.getElementById("slots-container");

  //     if (!response.slots || response.slots.length === 0) {
  //       container.innerHTML = "<p>No slots available for this date</p>";
  //       return;
  //     }

  //     container.innerHTML = response.slots
  //       .map(
  //         (slot, index) => `
  //               <div class="slot-option ${index === 0 ? "selected" : ""}"
  //                    data-slot-id="${slot.id}"
  //                    onclick="app.selectSlot(${slot.id})">
  //                   ${Utils.formatTime(slot.slot_start)} - ${Utils.formatTime(slot.slot_end)}
  //                   <small>(${slot.available_slots} slots available)</small>
  //               </div>
  //           `,
  //       )
  //       .join("");

  //     this.selectedSlot = response.slots[0].id;
  //   } catch (error) {
  //     console.error("Failed to load delivery slots:", error);
  //     Utils.showToast("Failed to load delivery slots", "error");
  //   }
  // }

  async loadDeliverySlots(date) {
    try {
      const response = await API.slots.getAvailable(date);
      const container = document.getElementById("slots-container");

      const now = new Date();

      container.innerHTML = response.slots
        .map((slot) => {
          const slotTime = new Date(`${date} ${slot.slot_start}`);
          const isPast = slotTime < now;

          return `
        <div class="slot-option ${isPast ? "disabled" : ""}"
             ${isPast ? "" : `onclick="app.selectSlot(${slot.id})"`}>
          ${Utils.formatTime(slot.slot_start)} - ${Utils.formatTime(slot.slot_end)}
          ${isPast ? "<small>(Expired)</small>" : ""}
        </div>
      `;
        })
        .join("");

      const validSlot = response.slots.find((s) => {
        const slotTime = new Date(`${date} ${s.slot_start}`);
        return slotTime > now;
      });

      if (validSlot) {
        this.selectedSlot = validSlot.id;
      }
    } catch (error) {
      Utils.showToast("Failed to load slots", "error");
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

  // async placeOrder() {
  //   if (!this.selectedSlot) {
  //     Utils.showToast("Please select a delivery slot", "error");
  //     return;
  //   }

  //   const deliveryDate = document.getElementById("delivery-date").value;
  //   const paymentMethod = document.querySelector(
  //     'input[name="payment"]:checked',
  //   ).value;

  //   try {
  //     const addresses = await API.societies.getMyAddresses();

  //     if (!addresses.addresses || addresses.addresses.length === 0) {
  //       Utils.showToast("No delivery address found", "error");
  //       return;
  //     }

  //     const orderData = {
  //       address_id: addresses.addresses[0].id,
  //       delivery_slot_id: this.selectedSlot,
  //       delivery_date: deliveryDate,
  //       items: cart.getOrderItems(),
  //       payment_method: paymentMethod,
  //     };

  //     const response = await API.orders.create(orderData);

  //     Utils.showToast("Order placed successfully! 🎉", "success");
  //     Utils.hideModal("checkout-modal");
  //     cart.clear();
  //     this.renderProducts();

  //     alert(
  //       `Order #${response.order.order_number} placed!\nTotal: ${Utils.formatPrice(response.order.total_amount)}`,
  //     );
  //   } catch (error) {
  //     console.error("Order placement error:", error);
  //     Utils.showToast(error.message || "Failed to place order", "error");
  //   }
  // }

  async placeOrder() {
    if (!this.selectedSlot) {
      Utils.showToast("Please select a delivery slot", "error");
      return;
    }

    const deliveryDate = document.getElementById("delivery-date").value;
    const paymentMethod = document.querySelector(
      'input[name="payment"]:checked',
    )?.value;

    if (!paymentMethod) {
      Utils.showToast("Select payment method", "error");
      return;
    }

    try {
      const addresses = await API.societies.getMyAddresses();

      if (!addresses.addresses || addresses.addresses.length === 0) {
        Utils.showToast("No address found", "error");
        return;
      }

      const orderData = {
        address_id: addresses.addresses[0].id,
        delivery_slot_id: this.selectedSlot,
        delivery_date: deliveryDate,
        items: cart.getOrderItems(),
        payment_method: paymentMethod,
      };

      console.log("🚀 ORDER:", orderData);

      await API.orders.create(orderData);

      Utils.showToast("Order placed 🎉", "success");
      Utils.hideModal("checkout-modal");

      cart.clear();
      this.renderProducts();
    } catch (error) {
      console.error(error);
      Utils.showToast(error.message || "Order failed", "error");
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
  console.log("🌟 ShiviMart Starting...");
  window.app = new App();
});

// Helper function for inline onclick navigation
function switchPage(pageName) {
  document.querySelectorAll(".page").forEach((p) => (p.style.display = "none"));
  document.getElementById("page-" + pageName).style.display = "block";
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("nav-" + pageName).classList.add("active");
}
