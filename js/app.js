/**
 * Основное интерактивное приложение Mila_sladco
 */
document.addEventListener("DOMContentLoaded", () => {
  // Инициализация каталога и корзины
  CatalogManager.init();
  Cart.init(CatalogManager);
  if (typeof AdminPanel !== "undefined") {
    AdminPanel.init();
  }

  let activeCategory = "all";
  let currentDetailProduct = null;
  let modalDetailQuantity = 1;

  // Элементы DOM
  const navPills = document.querySelectorAll(".nav-pill-btn");
  const taplinkView = document.getElementById("view-taplink");
  const showcaseView = document.getElementById("view-showcase");
  const productsGrid = document.getElementById("products-grid");
  const categoryFilters = document.getElementById("category-filters");
  const taplinkHits = document.getElementById("taplink-hits");
  const floatingCart = document.getElementById("floating-cart");
  const cartBadgeCount = document.getElementById("cart-badge-count");
  const cartBadgePrice = document.getElementById("cart-badge-price");

  // Модальные окна
  const productModal = document.getElementById("product-modal");
  const cartModal = document.getElementById("cart-modal");
  const toastMsg = document.getElementById("toast-msg");

  // Десктоп переключатель ширины
  const btnToggleWide = document.getElementById("btn-toggle-wide");
  if (btnToggleWide) {
    btnToggleWide.addEventListener("click", () => {
      document.body.classList.toggle("wide-mode");
      const isWide = document.body.classList.contains("wide-mode");
      btnToggleWide.textContent = isWide ? "📱 Мобильный вид" : "💻 Широкий экран";
    });
  }

  // Переключение табов Таплинк <-> Витрина
  window.switchTab = (tabName) => {
    navPills.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    if (tabName === "taplink") {
      taplinkView.classList.add("active");
      showcaseView.classList.remove("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      taplinkView.classList.remove("active");
      showcaseView.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  navPills.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Рендеринг категорий с динамическими счетчиками
  function renderCategories() {
    if (!categoryFilters) return;
    const allProducts = CatalogManager.getProducts();

    const catCounts = {
      all: allProducts.length,
      pastry: allProducts.filter((p) => p.category === "pastry").length,
      boxes: allProducts.filter((p) => p.category === "boxes").length,
      bento: allProducts.filter((p) => p.category === "bento").length
    };

    categoryFilters.innerHTML = CATEGORIES.map((cat) => `
      <button class="cat-btn ${cat.id === activeCategory ? "active" : ""}" data-id="${cat.id}">
        ${cat.name} (${catCounts[cat.id] || 0})
      </button>
    `).join("");

    categoryFilters.querySelectorAll(".cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.id;
        renderCategories();
        renderProducts();
      });
    });
  }

  // Рендеринг товаров в витрине
  function renderProducts() {
    if (!productsGrid) return;

    const allProducts = CatalogManager.getProducts();
    const filtered = activeCategory === "all"
      ? allProducts
      : allProducts.filter((p) => p.category === activeCategory);

    if (filtered.length === 0) {
      productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--color-muted);">
          <p style="font-size: 32px; margin-bottom: 8px;">🍰</p>
          <p style="font-weight: 600;">В этой категории пока нет десертов</p>
          <p style="font-size: 13px;">Кондитер Люда скоро добавит новые вкусы!</p>
        </div>
      `;
      return;
    }

    productsGrid.innerHTML = filtered.map((p) => {
      const isAvailable = p.isAvailable !== false;
      return `
        <div class="product-card ${!isAvailable ? "card-out-of-stock" : ""}" data-id="${p.id}">
          <div class="product-img-wrap" onclick="openProductDetail('${p.id}')">
            <img src="${p.image}" alt="${p.title}" class="product-img" loading="lazy" />
            ${!isAvailable 
              ? `<span class="product-badge" style="background: #495057;">Закончился</span>` 
              : (p.badge ? `<span class="product-badge badge-${p.badgeColor || 'gold'}">${p.badge}</span>` : "")
            }
          </div>
          <div class="product-info">
            <h3 class="product-title" onclick="openProductDetail('${p.id}')">${p.title}</h3>
            <p class="product-desc">${p.shortDesc}</p>
            <div class="product-bottom">
              <div class="product-price-box">
                <span class="product-price">${p.price} ₽</span>
                <span class="product-weight">${p.weight || "110 г"}</span>
              </div>
              ${isAvailable 
                ? `<button class="btn-add-cart" title="В корзину" onclick="quickAddToCart('${p.id}', event)">+</button>`
                : `<span style="font-size: 11px; color: #868E96; font-weight: 600;">Нет на витрине</span>`
              }
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Рендеринг хитов на экране Таплинка
  function renderTaplinkHits() {
    if (!taplinkHits) return;
    const available = CatalogManager.getProducts().filter((p) => p.isAvailable !== false);
    const hits = available.slice(0, 4);

    taplinkHits.innerHTML = hits.map((p) => `
      <div class="preview-mini-card" onclick="openProductDetail('${p.id}')">
        <img src="${p.image}" alt="${p.title}" class="preview-mini-img" loading="lazy" />
        <div class="preview-mini-name">${p.title}</div>
        <div class="preview-mini-price">${p.price} ₽</div>
      </div>
    `).join("");
  }

  // Быстрое добавление в корзину с карточки
  window.quickAddToCart = (productId, e) => {
    if (e) e.stopPropagation();
    const success = Cart.addItem(productId, 1);
    if (success) {
      showToast("Десерт добавлен в корзину ✨");
    } else {
      showToast("Этот десерт сегодня закончился 😔");
    }
  };

  // Открытие подробного модального окна десерта
  window.openProductDetail = (productId) => {
    const product = CatalogManager.getProductById(productId);
    if (!product) return;

    currentDetailProduct = product;
    modalDetailQuantity = 1;

    document.getElementById("detail-modal-img").src = product.image;
    document.getElementById("detail-modal-img").alt = product.title;
    document.getElementById("detail-modal-title").textContent = product.title;
    document.getElementById("detail-modal-price").textContent = `${product.price} ₽`;
    document.getElementById("detail-modal-weight").textContent = `Вес: ${product.weight || "110 г"} • Срок хранения: ${product.shelfLife || "72 часа"}`;
    document.getElementById("detail-modal-desc").textContent = product.fullDesc || product.shortDesc;

    // Слои
    const layersList = document.getElementById("detail-modal-layers");
    if (product.layers && product.layers.length > 0) {
      layersList.innerHTML = product.layers.map((l) => `<li>${l}</li>`).join("");
      document.getElementById("detail-layers-wrap").style.display = "block";
    } else {
      document.getElementById("detail-layers-wrap").style.display = "none";
    }

    // КБЖУ
    const nutr = product.nutrition || { calories: "290 ккал", proteins: "4.5 г", fats: "16 г", carbs: "32 г" };
    document.getElementById("nutr-cal").textContent = nutr.calories;
    document.getElementById("nutr-prot").textContent = nutr.proteins;
    document.getElementById("nutr-fat").textContent = nutr.fats;
    document.getElementById("nutr-carb").textContent = nutr.carbs;

    // Состав
    document.getElementById("detail-modal-ingredients").textContent = product.ingredients || "Натуральные ингредиенты высшего качества.";

    // Счетчик и доступность кнопки
    const isAvailable = product.isAvailable !== false;
    const addBtn = document.getElementById("btn-detail-add");
    const qtyCounter = document.getElementById("detail-qty-counter");

    if (isAvailable) {
      addBtn.disabled = false;
      addBtn.style.opacity = "1";
      if (qtyCounter) qtyCounter.style.display = "flex";
      document.getElementById("detail-qty-val").textContent = modalDetailQuantity;
      updateModalAddButtonPrice();
    } else {
      addBtn.disabled = true;
      addBtn.style.opacity = "0.5";
      if (qtyCounter) qtyCounter.style.display = "none";
      document.getElementById("btn-detail-add-text").textContent = "Временно закончился";
    }

    productModal.classList.add("open");
  };

  window.closeProductModal = () => {
    productModal.classList.remove("open");
  };

  window.changeDetailQty = (delta) => {
    modalDetailQuantity += delta;
    if (modalDetailQuantity < 1) modalDetailQuantity = 1;
    document.getElementById("detail-qty-val").textContent = modalDetailQuantity;
    updateModalAddButtonPrice();
  };

  function updateModalAddButtonPrice() {
    if (!currentDetailProduct) return;
    const total = currentDetailProduct.price * modalDetailQuantity;
    document.getElementById("btn-detail-add-text").textContent = `Добавить в корзину • ${total} ₽`;
  }

  window.addDetailToCart = () => {
    if (!currentDetailProduct) return;
    const success = Cart.addItem(currentDetailProduct.id, modalDetailQuantity);
    if (success) {
      closeProductModal();
      showToast(`Добавлено: ${currentDetailProduct.title} (${modalDetailQuantity} шт) ✨`);
    } else {
      showToast("Десерт недоступен для заказа");
    }
  };

  // Управление Корзиной
  window.openCart = () => {
    renderCartItems();
    cartModal.classList.add("open");
  };

  window.closeCart = () => {
    cartModal.classList.remove("open");
  };

  function renderCartItems() {
    const list = document.getElementById("cart-items-list");
    const emptyState = document.getElementById("cart-empty-state");
    const checkoutBox = document.getElementById("checkout-box");
    const cartSummary = document.getElementById("cart-summary");

    if (Cart.items.length === 0) {
      list.innerHTML = "";
      emptyState.style.display = "block";
      checkoutBox.style.display = "none";
      cartSummary.style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    checkoutBox.style.display = "block";
    cartSummary.style.display = "flex";

    list.innerHTML = Cart.items.map((item) => `
      <div class="cart-item-row">
        <img src="${item.image}" alt="${item.title}" class="cart-item-img" />
        <div class="cart-item-info">
          <div class="cart-item-title">${item.title}</div>
          <div class="cart-item-price">${item.price} ₽ / шт</div>
        </div>
        <div class="cart-item-ctrl">
          <button class="cart-ctrl-btn" onclick="Cart.updateQuantity('${item.id}', -1)">−</button>
          <span class="cart-item-count">${item.quantity}</span>
          <button class="cart-ctrl-btn" onclick="Cart.updateQuantity('${item.id}', 1)">+</button>
        </div>
      </div>
    `).join("");

    document.getElementById("cart-total-price").textContent = `${Cart.getTotalPrice()} ₽`;
  }

  // Обновление состояния корзины
  document.addEventListener("cart:updated", (e) => {
    const { totalCount, totalPrice } = e.detail;

    if (totalCount > 0) {
      floatingCart.classList.add("visible");
      cartBadgeCount.textContent = `${totalCount} шт`;
      cartBadgePrice.textContent = `${totalPrice} ₽`;
    } else {
      floatingCart.classList.remove("visible");
    }

    if (cartModal.classList.contains("open")) {
      renderCartItems();
    }
  });

  // Авто-обновление интерфейса при изменении каталога Людой
  document.addEventListener("catalog:updated", () => {
    renderCategories();
    renderProducts();
    renderTaplinkHits();
  });

  // Выбор мессенджера (MAX / Telegram)
  let selectedMessenger = "max";
  const messengerOptions = document.querySelectorAll(".messenger-option");
  const btnSendOrder = document.getElementById("btn-send-order");

  messengerOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      messengerOptions.forEach((o) => o.classList.remove("selected", "tg"));
      const isTg = opt.dataset.type === "telegram";
      selectedMessenger = opt.dataset.type;

      if (isTg) {
        opt.classList.add("selected", "tg");
        btnSendOrder.className = "btn-send-order tg-style";
        btnSendOrder.innerHTML = `✈️ Отправить заказ в Telegram`;
      } else {
        opt.classList.add("selected");
        btnSendOrder.className = "btn-send-order max-style";
        btnSendOrder.innerHTML = `💬 Отправить заказ в MAX`;
      }
    });
  });

  // Отправка заказа
  window.submitOrder = () => {
    if (Cart.items.length === 0) {
      showToast("Корзина пуста");
      return;
    }

    const name = document.getElementById("order-name").value.trim();
    const phone = document.getElementById("order-phone").value.trim();
    const date = document.getElementById("order-date").value;
    const time = document.getElementById("order-time").value;
    const deliveryType = document.getElementById("order-delivery").value;
    const address = document.getElementById("order-address").value.trim();
    const comment = document.getElementById("order-comment").value.trim();

    if (!name) {
      showToast("Пожалуйста, укажите ваше имя");
      document.getElementById("order-name").focus();
      return;
    }

    if (!phone) {
      showToast("Пожалуйста, укажите контактный телефон или ник");
      document.getElementById("order-phone").focus();
      return;
    }

    const formData = {
      name,
      phone,
      date,
      time,
      deliveryType,
      address,
      comment,
      messenger: selectedMessenger
    };

    const orderText = Cart.generateOrderText(formData);

    // Копируем текст в буфер обмена для страховки
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(orderText).catch(() => {});
    }

    showToast("Формируем заказ и открываем чат...");

    setTimeout(() => {
      if (selectedMessenger === "telegram") {
        const encodedText = encodeURIComponent(orderText);
        const tgUrl = `https://t.me/${SHOP_INFO.telegramUsername}?text=${encodedText}`;
        window.open(tgUrl, "_blank");
      } else {
        const encodedText = encodeURIComponent(orderText);
        const maxUrl = `https://max.ru/${SHOP_INFO.maxUsername}?message=${encodedText}`;
        window.open(maxUrl, "_blank");
      }

      Cart.clear();
      closeCart();
      showToast("Заказ сформирован! Нажмите «Отправить» в мессенджере 💌");
    }, 600);
  };

  // Toast
  window.showToast = (msg) => {
    if (!toastMsg) return;
    toastMsg.textContent = msg;
    toastMsg.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toastMsg.classList.remove("show");
    }, 2800);
  };

  // Рендеринг профиля шефа (аватарка и статус)
  function renderProfile() {
    const profile = CatalogManager.getProfile();
    if (!profile) return;
    const avatarImg = document.querySelector(".avatar-img");
    if (avatarImg && profile.avatar) {
      avatarImg.src = profile.avatar;
    }
  }

  document.addEventListener("profile:updated", renderProfile);

  // Первоначальный рендер
  renderProfile();
  renderCategories();
  renderProducts();
  renderTaplinkHits();

  // Автозаполнение даты: завтра по умолчанию
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const orderDateInput = document.getElementById("order-date");
  if (orderDateInput) {
    orderDateInput.value = tomorrowStr;
    orderDateInput.min = new Date().toISOString().split("T")[0];
  }
});
