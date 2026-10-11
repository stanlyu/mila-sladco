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

    const scrollBody = productModal.querySelector(".sheet-scroll-body");
    if (scrollBody) scrollBody.scrollTop = 0;
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
    if (typeof window.backToOrderEdit === "function") {
      window.backToOrderEdit();
    }
    renderCartItems();
    const scrollBody = cartModal.querySelector(".sheet-scroll-body");
    if (scrollBody) scrollBody.scrollTop = 0;
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
    const timeSelect = document.getElementById("order-time").value;
    const customTimeInput = document.getElementById("order-custom-time");
    const deliveryType = document.getElementById("order-delivery").value;
    const address = document.getElementById("order-address").value.trim();
    const comment = document.getElementById("order-comment").value.trim();

    let time = timeSelect;
    if (timeSelect === "custom") {
      const customVal = customTimeInput ? customTimeInput.value.trim() : "";
      time = customVal ? `К точному времени: ${customVal}` : "К точному времени (по согласованию)";
    }

    if (!name) {
      showToast("Пожалуйста, укажите ваше имя", 3500);
      document.getElementById("order-name").focus();
      return;
    }

    if (!phone) {
      showToast("Пожалуйста, укажите контактный телефон или ник", 3500);
      document.getElementById("order-phone").focus();
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const isToday = date === todayStr;
    const dateDisplay = isToday ? `${date} (⚡ Срочно сегодня)` : date;

    const formData = {
      name,
      phone,
      date: dateDisplay,
      time,
      deliveryType,
      address,
      pickupAddress: (profile.pickupAddress || "Москва, м. Раменки").trim(),
      comment,
      messenger: selectedMessenger
    };

    const orderText = Cart.generateOrderText(formData);

    let currentOrderText = "";
    let currentMessengerUrl = "";

    window.confirmOrderFinished = () => {
      Cart.clear();
      closeCart();
      showToast("Спасибо за заказ! Шеф Люда свяжется с вами в течение 10-15 минут 🍰✨", 5000);
      backToOrderEdit();
    };

    window.copyOrderTextAgain = () => {
      if (currentOrderText && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentOrderText)
          .then(() => showToast("Чек заказа скопирован в буфер обмена! 📋"))
          .catch(() => showToast("Чек скопирован! 📋"));
      } else {
        showToast("Чек заказа скопирован! 📋");
      }
    };

    window.retryOpenMessenger = () => {
      if (currentMessengerUrl) {
        window.open(currentMessengerUrl, "_blank");
      }
    };

    window.backToOrderEdit = () => {
      const mainFlow = document.getElementById("cart-main-flow");
      const successScreen = document.getElementById("order-success-screen");
      if (mainFlow) mainFlow.style.display = "block";
      if (successScreen) successScreen.style.display = "none";
    };

    const profile = (typeof CatalogManager !== "undefined" && CatalogManager.getProfile) 
      ? CatalogManager.getProfile() 
      : {};

    const rawTg = (profile.telegramUsername || "").trim();
    const cleanTg = rawTg.replace(/^https?:\/\/t\.me\//i, "").replace(/^t\.me\//i, "").replace(/^@/, "").trim();

    let rawMax = (profile.maxUsername || "").trim();
    const maxUrlMatch = rawMax.match(/https?:\/\/[^\s]+/i);
    if (maxUrlMatch) {
      rawMax = maxUrlMatch[0];
    }
    const cleanMax = rawMax.replace(/^https?:\/\/max\.ru\//i, "").replace(/^max\.ru\//i, "").replace(/^@/, "").trim();

    const targetUser = selectedMessenger === "telegram" ? cleanTg : cleanMax;

    currentOrderText = orderText;

    if (!targetUser || targetUser === "none") {
      showToast("💡 Чек скопирован в буфер! Для автоматической отправки укажите свой логин в Кабинете кондитера → «Контакты & ссылки».", 4500);
      // Показываем экран подтверждения, чтобы гость мог скопировать чек
      const mainFlow = document.getElementById("cart-main-flow");
      const successScreen = document.getElementById("order-success-screen");
      if (mainFlow) mainFlow.style.display = "none";
      if (successScreen) successScreen.style.display = "block";
      return;
    }

    let messengerUrl = "";
    if (selectedMessenger === "telegram") {
      const encodedText = encodeURIComponent(orderText);
      messengerUrl = `https://t.me/${cleanTg}?text=${encodedText}`;
    } else {
      let baseMax = rawMax;
      if (!/^https?:\/\//i.test(baseMax)) {
        if (/^(u|join)\//i.test(baseMax)) {
          baseMax = `https://max.ru/${baseMax}`;
        } else {
          baseMax = `https://max.ru/u/${baseMax}`;
        }
      }
      messengerUrl = baseMax;
    }

    currentMessengerUrl = messengerUrl;

    try {
      window.open(messengerUrl, "_blank");
    } catch (e) {
      console.warn("Не удалось автоматически открыть окно", e);
    }

    // Переключаем на экран подтверждения (корзина сохраняется, пока гость не нажмет «Заказ отправлен»)
    const mainFlow = document.getElementById("cart-main-flow");
    const successScreen = document.getElementById("order-success-screen");
    const msgHint = document.getElementById("order-success-msg");
    if (mainFlow) mainFlow.style.display = "none";
    if (successScreen) successScreen.style.display = "block";
    if (msgHint) {
      if (selectedMessenger === "telegram") {
        msgHint.innerHTML = `Мы сформировали чек и открыли диалог в <b>Telegram</b>.<br />Нажмите <b>«Отправить»</b> в открывшемся чате.`;
      } else {
        msgHint.innerHTML = `Мы сформировали чек и открыли диалог в <b>MAX</b>.<br />Чек скопирован в буфер обмена: просто <b>вставьте</b> его в поле сообщения и нажмите <b>«Отправить»</b>.`;
      }
    }
    showToast("Заказ сформирован! Чек открыт в чате 💌", 3500);
  };

  // Выбор даты "Срочно сегодня"
  window.setOrderDateToday = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const orderDateInput = document.getElementById("order-date");
    const todayBtn = document.getElementById("btn-order-today");
    if (orderDateInput) {
      orderDateInput.value = todayStr;
    }
    if (todayBtn) {
      todayBtn.classList.add("active");
    }
    showToast("Выбрана сегодняшняя дата для срочного заказа ⚡", 3000);
  };

  // Переключение точного времени
  window.toggleCustomTime = (val) => {
    const customInput = document.getElementById("order-custom-time");
    if (customInput) {
      customInput.style.display = val === "custom" ? "block" : "none";
      if (val === "custom") {
        setTimeout(() => customInput.focus(), 100);
      }
    }
  };

  // Переключение способа доставки (доставка / самовывоз)
  window.toggleDeliveryType = (val) => {
    const addressGroup = document.getElementById("address-group");
    const pickupGroup = document.getElementById("pickup-group");
    if (addressGroup) addressGroup.style.display = val === "delivery" ? "block" : "none";
    if (pickupGroup) pickupGroup.style.display = val === "pickup" ? "block" : "none";
  };

  // Toast с настраиваемой длительностью (по умолчанию 3.5 - 4 секунды)
  window.showToast = (msg, duration = 3800) => {
    if (!toastMsg) return;
    toastMsg.textContent = msg;
    toastMsg.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toastMsg.classList.remove("show");
    }, duration);
  };

  // Автоматическая блокировка скролла фона при открытых модалках
  function initModalScrollLock() {
    const overlays = document.querySelectorAll(".modal-overlay");
    const checkState = () => {
      const anyOpen = Array.from(overlays).some((m) => m.classList.contains("open"));
      document.body.classList.toggle("modal-open", anyOpen);
    };

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(checkState);
      overlays.forEach((m) => {
        observer.observe(m, { attributes: true, attributeFilter: ["class"] });
      });
    }
  }

  // Рендеринг профиля шефа (аватарка, статус, ссылки и телефон)
  function renderProfile() {
    const profile = CatalogManager.getProfile();
    if (!profile) return;
    const avatarImg = document.querySelector(".avatar-img");
    if (avatarImg && profile.avatar) {
      avatarImg.src = profile.avatar;
    }

    // Ссылки и кнопки в таплинке
    // 1. Написать в MAX (личный чат)
    const maxBtn = document.getElementById("link-btn-max");
    if (maxBtn) {
      maxBtn.style.display = (profile.showMaxDirect !== false) ? "flex" : "none";
      let rawMax = (profile.maxUsername || "").trim();
      const maxUrlMatch = rawMax.match(/https?:\/\/[^\s]+/i);
      if (maxUrlMatch) {
        rawMax = maxUrlMatch[0];
      }
      if (rawMax && rawMax !== "none") {
        let baseMax = rawMax;
        if (!/^https?:\/\//i.test(baseMax)) {
          if (/^(u|join)\//i.test(baseMax)) {
            baseMax = `https://max.ru/${baseMax}`;
          } else {
            baseMax = `https://max.ru/u/${baseMax}`;
          }
        }
        maxBtn.href = baseMax;
        maxBtn.onclick = null;
      } else {
        maxBtn.href = "javascript:void(0)";
        maxBtn.onclick = (e) => {
          e.preventDefault();
          showToast("💡 Ссылку на профиль в MAX кондитер Люда укажет в своем кабинете");
        };
      }
    }

    // 2. Написать в Telegram (личный чат)
    const tgDirectBtn = document.getElementById("link-btn-telegram-direct");
    if (tgDirectBtn) {
      tgDirectBtn.style.display = (profile.showTelegramDirect !== false) ? "flex" : "none";
      const cleanTg = (profile.telegramUsername || "").trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^t\.me\//i, "").replace(/^@/, "").trim();
      if (cleanTg && cleanTg !== "none") {
        tgDirectBtn.href = `https://t.me/${cleanTg}`;
        tgDirectBtn.onclick = null;
      } else {
        tgDirectBtn.href = "javascript:void(0)";
        tgDirectBtn.onclick = (e) => {
          e.preventDefault();
          showToast("💡 Логин в Telegram кондитер Люда укажет в своем кабинете");
        };
      }
    }

    // 3. Наш Telegram-канал
    const tgBtn = document.getElementById("link-btn-telegram");
    if (tgBtn) {
      tgBtn.style.display = (profile.showTelegramChannel !== false) ? "flex" : "none";
      const tgChannel = (profile.telegramChannelUrl || "").trim();
      if (tgChannel && tgChannel !== "none") {
        tgBtn.href = tgChannel;
        tgBtn.onclick = null;
      } else {
        tgBtn.href = "javascript:void(0)";
        tgBtn.onclick = (e) => {
          e.preventDefault();
          showToast("💡 Ссылку на Telegram-канал кондитер Люда укажет в кабинете");
        };
      }
    }

    // 4. Наш MAX-канал
    const maxChanBtn = document.getElementById("link-btn-max-channel");
    if (maxChanBtn) {
      maxChanBtn.style.display = profile.showMaxChannel ? "flex" : "none";
      const maxChannel = (profile.maxChannelUrl || "").trim();
      if (maxChannel && maxChannel !== "none") {
        maxChanBtn.href = maxChannel;
        maxChanBtn.onclick = null;
      } else {
        maxChanBtn.href = "javascript:void(0)";
        maxChanBtn.onclick = (e) => {
          e.preventDefault();
          showToast("💡 Ссылку на MAX-канал кондитер Люда укажет в кабинете");
        };
      }
    }

    const phoneBtn = document.getElementById("link-btn-phone");
    const phoneSub = document.getElementById("link-sub-phone");
    if (phoneBtn) {
      phoneBtn.style.display = profile.showPhone ? "flex" : "none";
      if (profile.protectPhone !== false) {
        // Защита от спам-ботов активна: открываем интерактивный капча-тест
        phoneBtn.href = "javascript:void(0)";
        phoneBtn.onclick = (e) => {
          e.preventDefault();
          PhoneProtection.showModal();
        };
      } else {
        // Защита отключена кондитером: прямой tel:
        phoneBtn.onclick = null;
        if (profile.phoneClean || profile.phone) {
          phoneBtn.href = `tel:${profile.phoneClean || profile.phone}`;
        }
      }
    }
    if (phoneSub && profile.phone) {
      phoneSub.textContent = `Если праздник уже сегодня: ${profile.phone}`;
    }

    // Подсказка адреса самовывоза в корзине
    const pickupHint = document.getElementById("cart-pickup-address-hint");
    if (pickupHint) {
      pickupHint.textContent = profile.pickupAddress || "Москва, м. Раменки";
    }
    const pickupOpt = document.getElementById("order-delivery-pickup-opt");
    if (pickupOpt) {
      pickupOpt.textContent = `🚶 Самовывоз (${profile.pickupAddress || "м. Раменки"})`;
    }
  }

  // Защита номера телефона шефа от автоматических спам-ботов
  const PhoneProtection = {
    isVerified: false,

    showModal() {
      const modal = document.getElementById("phone-protect-modal");
      if (!modal) return;
      const profile = typeof CatalogManager !== "undefined" ? CatalogManager.getProfile() : null;
      const phone = (profile && profile.phone) ? profile.phone : "+7 (915) 318-18-19";
      const phoneClean = (profile && profile.phoneClean) ? profile.phoneClean : "+79153181819";

      const numEl = document.getElementById("phone-protect-number");
      const callBtn = document.getElementById("phone-protect-call-btn");
      if (numEl) numEl.textContent = phone;
      if (callBtn) callBtn.href = `tel:${phoneClean}`;

      const challengeEl = document.getElementById("phone-protect-challenge");
      const resultEl = document.getElementById("phone-protect-result");
      const errBox = document.getElementById("phone-protect-error");

      if (errBox) {
        errBox.style.display = "none";
        errBox.textContent = "";
      }

      if (this.isVerified) {
        if (challengeEl) challengeEl.style.display = "none";
        if (resultEl) resultEl.style.display = "block";
      } else {
        if (challengeEl) challengeEl.style.display = "block";
        if (resultEl) resultEl.style.display = "none";
      }

      modal.classList.add("open");
    },

    closeModal() {
      const modal = document.getElementById("phone-protect-modal");
      if (modal) modal.classList.remove("open");
    },

    chooseOption(isCorrect) {
      const errBox = document.getElementById("phone-protect-error");
      if (!isCorrect) {
        if (errBox) {
          errBox.textContent = "Не совсем то! Выберите десерт 🍰, чтобы подтвердить, что вы человек.";
          errBox.style.display = "block";
        }
        return;
      }

      this.isVerified = true;
      const challengeEl = document.getElementById("phone-protect-challenge");
      const resultEl = document.getElementById("phone-protect-result");
      if (challengeEl) challengeEl.style.display = "none";
      if (resultEl) {
        resultEl.style.display = "block";
      }
      if (typeof showToast === "function") {
        showToast("✅ Номер телефона открыт!");
      }
    },

    copyNumber() {
      const profile = typeof CatalogManager !== "undefined" ? CatalogManager.getProfile() : null;
      const phone = (profile && profile.phone) ? profile.phone : "+7 (915) 318-18-19";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phone).then(() => {
          if (typeof showToast === "function") {
            showToast("📋 Номер скопирован в буфер обмена!");
          }
        }).catch(() => {
          if (typeof showToast === "function") {
            showToast(`Номер: ${phone}`);
          }
        });
      } else {
        if (typeof showToast === "function") {
          showToast(`Номер: ${phone}`);
        }
      }
    }
  };
  window.PhoneProtection = PhoneProtection;

  window.renderProfile = renderProfile;
  document.addEventListener("profile:updated", renderProfile);
  initModalScrollLock();

  // Первоначальный рендер
  renderProfile();
  renderCategories();
  renderProducts();
  renderTaplinkHits();

  // Фоновая проверка актуальности базы данных (GitHub / Cloud)
  if (typeof SyncService !== "undefined") {
    SyncService.pullFromRemote().then((res) => {
      if (res && res.success) {
        renderProfile();
        renderCategories();
        renderProducts();
        renderTaplinkHits();
      }
    }).catch((e) => {
      console.warn("[App] Автосинхронизация базы:", e);
    });
  }

  document.addEventListener("sync:completed", () => {
    renderProfile();
    renderCategories();
    renderProducts();
    renderTaplinkHits();
  });

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
