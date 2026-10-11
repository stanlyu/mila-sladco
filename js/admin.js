/**
 * Панель управления для кондитера Люды (Mila_sladco Admin)
 * Защищена PIN-кодом и секретным входом.
 */

const AdminPanel = {
  editingProductId: null,
  avatarClickCount: 0,
  avatarClickTimer: null,

  init() {
    this.bindEvents();
    this.checkSecretUrl();
  },

  bindEvents() {
    // Слушатель обновления каталога
    document.addEventListener("catalog:updated", () => {
      this.renderAdminList();
    });

    // Секретный жест: 3 быстрых тапа по аватарке в шапке профиля
    const avatar = document.querySelector(".avatar-img");
    if (avatar) {
      avatar.addEventListener("click", () => {
        this.handleAvatarSecretTap();
      });
    }
  },

  // Проверка параметров URL (?admin или #admin)
  checkSecretUrl() {
    if (typeof window !== "undefined") {
      const url = window.location.href;
      if (url.includes("?admin") || url.includes("#admin")) {
        setTimeout(() => this.requestAccess(), 300);
      }
    }
  },

  // Обработка 3 быстрых тапов по фото
  handleAvatarSecretTap() {
    this.avatarClickCount++;
    clearTimeout(this.avatarClickTimer);

    if (this.avatarClickCount >= 3) {
      this.avatarClickCount = 0;
      this.requestAccess();
    } else {
      this.avatarClickTimer = setTimeout(() => {
        this.avatarClickCount = 0;
      }, 1200);
    }
  },

  // Запрос доступа: если уже авторизована - открываем, иначе запрашиваем PIN
  requestAccess() {
    if (AuthSecurity.isAuthenticated()) {
      this.open();
    } else {
      this.openPinModal();
    }
  },

  openPinModal() {
    const modal = document.getElementById("pin-modal");
    if (!modal) return;
    const now = Date.now();
    if (AuthSecurity.getLockUntil() <= now) {
      AuthSecurity.setFailedAttempts(0);
    }
    const pinInput = document.getElementById("pin-input-field");
    if (pinInput) {
      pinInput.value = "";
    }
    const errBox = document.getElementById("pin-error-box");
    if (errBox) {
      errBox.textContent = "";
      errBox.style.display = "none";
    }
    modal.classList.add("open");
    setTimeout(() => {
      if (pinInput) pinInput.focus();
    }, 200);
  },

  closePinModal() {
    const modal = document.getElementById("pin-modal");
    if (modal) modal.classList.remove("open");
  },

  // Проверка введенного PIN-кода
  submitPin() {
    const pinInput = document.getElementById("pin-input-field");
    const errBox = document.getElementById("pin-error-box");
    const pin = pinInput ? pinInput.value.trim() : "";

    if (!pin) {
      if (errBox) {
        errBox.textContent = "Пожалуйста, введите PIN-код";
        errBox.style.display = "block";
      }
      return;
    }

    if (pin.length < 4) {
      if (errBox) {
        errBox.textContent = "PIN-код должен состоять ровно из 4 цифр";
        errBox.style.display = "block";
      }
      return;
    }

    const res = AuthSecurity.verifyPin(pin);

    if (res.success) {
      this.closePinModal();
      this.open();
      showToast("Добро пожаловать в кабинет кондитера, Люда! ✨");
    } else {
      if (errBox) {
        errBox.textContent = res.message;
        errBox.style.display = "block";
      }
      if (pinInput) {
        pinInput.value = "";
        pinInput.focus();
      }
    }
  },

  // Выход из сессии кондитера
  logout() {
    AuthSecurity.logout();
    this.close();
    showToast("Вы вышли из режима кондитера 🔒");
  },

  open() {
    const modal = document.getElementById("admin-modal");
    if (!modal) return;
    this.updateChefAvatarPreview();
    this.renderAdminList();
    modal.classList.add("open");

    // Если Люда впервые в кабинете — запускаем интерактивный тур
    const profile = CatalogManager.getProfile();
    if (profile && !profile.hasSeenTour) {
      setTimeout(() => this.openTour(), 400);
    }
  },

  close() {
    const modal = document.getElementById("admin-modal");
    if (modal) modal.classList.remove("open");
    this.closeEditModal();
    this.hideBubble();
  },

  updateChefAvatarPreview() {
    const profile = CatalogManager.getProfile();
    const preview = document.getElementById("admin-chef-avatar-preview");
    if (preview && profile && profile.avatar) {
      preview.src = profile.avatar;
    }
  },

  async handleChefAvatarUpload(input) {
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        if (typeof SyncService !== "undefined" && typeof SyncService.compressImage === "function") {
          const compressed = await SyncService.compressImage(file, 400, 0.85);
          CatalogManager.updateProfile({ avatar: compressed });
          this.updateChefAvatarPreview();
          showToast("Фото шеф-кондитера обновлено! 📸✨");
          if (typeof SyncService !== "undefined") {
            SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
          }
          return;
        }
      } catch (e) {
        console.warn("Сжатие аватарки не удалось, загрузка оригинала", e);
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target.result;
        CatalogManager.updateProfile({ avatar: base64Url });
        this.updateChefAvatarPreview();
        showToast("Фото шеф-кондитера успешно обновлено! 📸✨");
        if (typeof SyncService !== "undefined") {
          SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
        }
      };
      reader.readAsDataURL(file);
    }
  },

  renderAdminList() {
    const list = document.getElementById("admin-products-list");
    if (!list) return;

    const products = CatalogManager.getProducts();

    list.innerHTML = products.map((p) => `
      <div class="admin-item-card ${p.isAvailable === false ? "item-disabled" : ""}">
        <div class="admin-item-header">
          <img src="${p.image}" alt="${p.title}" class="admin-item-thumb" />
          <div class="admin-item-info">
            <h4 class="admin-item-title">${p.title}</h4>
            <div class="admin-item-cat">${p.categoryName || "Десерт"} • ${p.weight || "110 г"}</div>
            <div class="admin-quick-price">
              <label>Цена: </label>
              <input type="number" class="admin-price-input" value="${p.price}" 
                onchange="AdminPanel.quickUpdatePrice('${p.id}', this.value)" /> ₽
              <button type="button" class="tooltip-bubble" onclick="AdminPanel.showBubble('price', this)" aria-label="Подсказка">?</button>
            </div>
          </div>
        </div>

        <div class="admin-item-actions">
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            <button type="button" class="btn-admin-action ${p.isAvailable === false ? "btn-status-off" : "btn-status-on"}" 
              onclick="AdminPanel.toggleStatus('${p.id}')">
              ${p.isAvailable === false ? "❌ Закончился" : "✅ В наличии"}
            </button>
            <button type="button" class="tooltip-bubble" onclick="AdminPanel.showBubble('status', this)" aria-label="Подсказка">?</button>
          </div>
          
          <button type="button" class="btn-admin-action btn-admin-edit" onclick="AdminPanel.openEditProduct('${p.id}')">
            ✏️ Изменить
          </button>

          <button type="button" class="btn-admin-action btn-admin-delete" onclick="AdminPanel.deleteProduct('${p.id}')">
            🗑
          </button>
        </div>
      </div>
    `).join("");
  },

  quickUpdatePrice(id, newPrice) {
    const priceNum = parseInt(newPrice, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast("Укажите корректную цену");
      return;
    }
    CatalogManager.updateProduct(id, { price: priceNum });
    showToast("Цена успешно обновлена! ✨");
    if (typeof SyncService !== "undefined") {
      SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
    }
  },

  toggleStatus(id) {
    const newStatus = CatalogManager.toggleAvailability(id);
    this.renderAdminList();
    showToast(newStatus ? "Десерт снова на витрине!" : "Десерт скрыт с витрины (закончился)");
    if (typeof SyncService !== "undefined") {
      SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
    }
  },

  deleteProduct(id) {
    const product = CatalogManager.getProductById(id);
    if (!product) return;
    if (confirm(`Удалить десерт «${product.title}» из каталога?`)) {
      CatalogManager.deleteProduct(id);
      this.renderAdminList();
      showToast("Десерт удален");
      if (typeof SyncService !== "undefined") {
        SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
      }
    }
  },

  // Открытие формы добавления нового десерта
  openAddNew() {
    this.editingProductId = null;
    document.getElementById("edit-modal-title").textContent = "✨ Добавить новый десерт";
    document.getElementById("form-edit-title").value = "";
    document.getElementById("form-edit-price").value = "450";
    document.getElementById("form-edit-weight").value = "110";
    document.getElementById("form-edit-cat").value = "pastry";
    document.getElementById("form-edit-badge").value = "Новинка";
    document.getElementById("form-edit-desc").value = "";
    document.getElementById("form-edit-ingredients").value = "";
    document.getElementById("form-edit-preview-img").src = "assets/images/placeholder-dessert.svg";
    document.getElementById("form-edit-image-url").value = "assets/images/placeholder-dessert.svg";

    document.getElementById("admin-edit-modal").classList.add("open");
  },

  // Открытие формы редактирования существующего десерта
  openEditProduct(id) {
    const product = CatalogManager.getProductById(id);
    if (!product) return;

    this.editingProductId = id;
    const cleanWeight = product.weight ? String(product.weight).replace(/\D/g, "") : "110";
    const prodImg = product.image || "assets/images/placeholder-dessert.svg";

    document.getElementById("edit-modal-title").textContent = `✏️ Редактирование: ${product.title}`;
    document.getElementById("form-edit-title").value = product.title;
    document.getElementById("form-edit-price").value = product.price;
    document.getElementById("form-edit-weight").value = cleanWeight;
    document.getElementById("form-edit-cat").value = product.category || "pastry";
    document.getElementById("form-edit-badge").value = product.badge || "";
    document.getElementById("form-edit-desc").value = product.fullDesc || product.shortDesc || "";
    document.getElementById("form-edit-ingredients").value = product.ingredients || "";
    document.getElementById("form-edit-preview-img").src = prodImg;
    document.getElementById("form-edit-image-url").value = prodImg;

    document.getElementById("admin-edit-modal").classList.add("open");
  },

  closeEditModal() {
    const modal = document.getElementById("admin-edit-modal");
    if (modal) modal.classList.remove("open");
    this.editingProductId = null;
  },

  // Загрузка фото с телефона/компьютера
  async handleImageUpload(input) {
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        if (typeof SyncService !== "undefined" && typeof SyncService.compressImage === "function") {
          const compressed = await SyncService.compressImage(file, 900, 0.82);
          document.getElementById("form-edit-preview-img").src = compressed;
          document.getElementById("form-edit-image-url").value = compressed;
          showToast("Фото десерта оптимизировано и загружено! 📸✨");
          return;
        }
      } catch (err) {
        console.warn("Сжатие не удалось, загрузка оригинала", err);
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target.result;
        document.getElementById("form-edit-preview-img").src = base64Url;
        document.getElementById("form-edit-image-url").value = base64Url;
        showToast("Фото успешно загружено! 📸");
      };
      reader.readAsDataURL(file);
    }
  },

  // Сохранение формы
  saveProductForm() {
    const title = document.getElementById("form-edit-title").value.trim();
    const priceDigits = document.getElementById("form-edit-price").value.replace(/\D/g, "");
    const price = parseInt(priceDigits, 10);
    const weightDigits = document.getElementById("form-edit-weight").value.replace(/\D/g, "");
    const weight = weightDigits ? `${weightDigits} г` : "110 г";
    const category = document.getElementById("form-edit-cat").value;
    const badge = document.getElementById("form-edit-badge").value.trim();
    const desc = document.getElementById("form-edit-desc").value.trim();
    const ingredients = document.getElementById("form-edit-ingredients").value.trim();
    const image = document.getElementById("form-edit-image-url").value || "assets/images/placeholder-dessert.svg";

    if (!title) {
      showToast("Пожалуйста, введите название десерта");
      return;
    }

    if (isNaN(price) || price <= 0) {
      showToast("Укажите правильную цену (только цифры)");
      return;
    }

    if (this.editingProductId) {
      CatalogManager.updateProduct(this.editingProductId, {
        title,
        price,
        weight,
        category,
        badge,
        shortDesc: desc,
        fullDesc: desc,
        ingredients,
        image
      });
      showToast("Десерт успешно обновлен! ✨");
    } else {
      CatalogManager.addProduct({
        title,
        price,
        weight,
        category,
        badge,
        shortDesc: desc,
        fullDesc: desc,
        ingredients,
        image
      });
      showToast("Новый десерт добавлен в витрину! 🍰");
    }

    this.closeEditModal();
    this.renderAdminList();

    // Фоновая синхронизация с облаком
    if (typeof SyncService !== "undefined") {
      SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
    }
  },

  // Смена PIN-кода Людой через модальное окно
  openChangePinModal() {
    const modal = document.getElementById("change-pin-modal");
    if (!modal) return;
    const oldInput = document.getElementById("pin-change-old");
    const newInput = document.getElementById("pin-change-new");
    const confirmInput = document.getElementById("pin-change-confirm");
    if (oldInput) oldInput.value = "";
    if (newInput) newInput.value = "";
    if (confirmInput) confirmInput.value = "";
    modal.classList.add("open");
    setTimeout(() => {
      if (oldInput) oldInput.focus();
    }, 200);
  },

  closeChangePinModal() {
    const modal = document.getElementById("change-pin-modal");
    if (modal) modal.classList.remove("open");
  },

  submitChangePin() {
    const oldInput = document.getElementById("pin-change-old");
    const newInput = document.getElementById("pin-change-new");
    const confirmInput = document.getElementById("pin-change-confirm");

    const oldPin = oldInput ? oldInput.value.trim() : "";
    const newPin = newInput ? newInput.value.trim() : "";
    const confirmPin = confirmInput ? confirmInput.value.trim() : "";

    if (!oldPin) {
      showToast("Введите текущий PIN-код! ⚠️", 4000);
      if (oldInput) oldInput.focus();
      return;
    }

    const currentHash = AuthSecurity.getStoredHash();
    if (hashPin(oldPin) !== currentHash) {
      showToast("Текущий PIN-код указан неверно! ❌", 4000);
      if (oldInput) {
        oldInput.value = "";
        oldInput.focus();
      }
      return;
    }

    if (!newPin || newPin.length !== 4) {
      showToast("Новый PIN-код должен состоять ровно из 4 цифр! ⚠️", 4000);
      if (newInput) newInput.focus();
      return;
    }

    if (newPin !== confirmPin) {
      showToast("Новый PIN-код и подтверждение не совпадают! ⚠️", 4000);
      if (confirmInput) {
        confirmInput.value = "";
        confirmInput.focus();
      }
      return;
    }

    const res = AuthSecurity.changePin(oldPin, newPin);
    if (res.success) {
      this.closeChangePinModal();
      showToast("PIN-код успешно изменен на новый! 🔐✨", 4000);
    } else {
      showToast(res.message, 4000);
    }
  },

  // Экспорт файла меню для Люды (бэкап)
  exportBackup() {
    const json = CatalogManager.exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mila_sladco_menu_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Резервная копия меню сохранена! 💾");
  },

  // Сброс к заводским настройкам (меню, аватарка, контакты, PIN)
  resetDefaults() {
    if (confirm("Вы точно хотите вернуть стандартные настройки? (все десерты, фото шефа и PIN 1819 сбросятся)")) {
      CatalogManager.resetToDefaults();
      AuthSecurity.resetToDefault();
      this.renderAdminList();
      this.updateChefAvatarPreview();
      if (typeof renderProfile === "function") {
        renderProfile();
      }
      if (typeof SyncService !== "undefined") {
        SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
      }
      showToast("Все настройки сброшены до стандартных (PIN 1819) ✨", 4000);
    }
  },

  // ==========================================
  // Восстановление PIN через 7 контрольных вопросов
  // ==========================================
  openPinRecoveryModal() {
    this.closePinModal();
    const modal = document.getElementById("pin-recovery-modal");
    if (!modal) return;
    
    // Очищаем поля
    for (let i = 0; i < 7; i++) {
      const input = document.getElementById(`rec-q-${i}`);
      if (input) input.value = "";
    }
    const errBox = document.getElementById("recovery-error-box");
    if (errBox) {
      errBox.textContent = "";
      errBox.style.display = "none";
    }
    const formBox = document.getElementById("recovery-questions-form");
    const successBox = document.getElementById("recovery-success-box");
    if (formBox) formBox.style.display = "block";
    if (successBox) successBox.style.display = "none";

    modal.classList.add("open");
    setTimeout(() => {
      const firstInput = document.getElementById("rec-q-0");
      if (firstInput) firstInput.focus();
    }, 200);
  },

  closePinRecoveryModal() {
    const modal = document.getElementById("pin-recovery-modal");
    if (modal) modal.classList.remove("open");
  },

  submitRecoveryQuestions() {
    const answers = [];
    for (let i = 0; i < 7; i++) {
      const input = document.getElementById(`rec-q-${i}`);
      answers.push(input ? input.value : "");
    }

    const errBox = document.getElementById("recovery-error-box");
    const res = AuthSecurity.verifyAllSecurityQuestions(answers);

    if (res.success) {
      if (errBox) errBox.style.display = "none";
      const formBox = document.getElementById("recovery-questions-form");
      const successBox = document.getElementById("recovery-success-box");
      if (formBox) formBox.style.display = "none";
      if (successBox) successBox.style.display = "block";
      showToast("Личность подтверждена! PIN сброшен до 1819 🔐✨", 4000);
    } else {
      if (errBox) {
        errBox.textContent = res.message;
        errBox.style.display = "block";
      }
      if (typeof res.failedIndex === "number") {
        const failInput = document.getElementById(`rec-q-${res.failedIndex}`);
        if (failInput) failInput.focus();
      }
    }
  },

  applyRecoveredPin() {
    this.closePinRecoveryModal();
    this.openPinModal();
    const pinInput = document.getElementById("pin-input-field");
    if (pinInput) {
      pinInput.value = "1819";
      setTimeout(() => this.submitPin(), 300);
    }
  },

  // ==========================================
  // Управление контактами и ссылками
  // ==========================================
  openContactsModal() {
    const modal = document.getElementById("contacts-modal");
    if (!modal) return;
    const profile = CatalogManager.getProfile() || {};
    const tgUser = document.getElementById("setting-tg-user");
    const tgChan = document.getElementById("setting-tg-channel");
    const maxUser = document.getElementById("setting-max-user");
    const maxChan = document.getElementById("setting-max-channel");
    const phoneInput = document.getElementById("setting-phone");
    const showPhoneCheckbox = document.getElementById("setting-show-phone");

    if (tgUser) tgUser.value = profile.telegramUsername || "";
    if (tgChan) tgChan.value = profile.telegramChannelUrl || "";
    if (maxUser) maxUser.value = profile.maxUsername || "";
    if (maxChan) maxChan.value = profile.maxChannelUrl || "";
    if (phoneInput) phoneInput.value = profile.phone || "+7 (915) 318-18-19";
    if (showPhoneCheckbox) showPhoneCheckbox.checked = Boolean(profile.showPhone);

    modal.classList.add("open");
  },

  closeContactsModal() {
    const modal = document.getElementById("contacts-modal");
    if (modal) modal.classList.remove("open");
  },

  saveContacts() {
    const tgUser = document.getElementById("setting-tg-user");
    const tgChan = document.getElementById("setting-tg-channel");
    const maxUser = document.getElementById("setting-max-user");
    const maxChan = document.getElementById("setting-max-channel");
    const phoneInput = document.getElementById("setting-phone");
    const showPhoneCheckbox = document.getElementById("setting-show-phone");

    const cleanTg = (tgUser ? tgUser.value.trim() : "").replace(/^@/, "");
    const tgChannel = tgChan ? tgChan.value.trim() : "";
    const maxLogin = (maxUser ? maxUser.value.trim() : "").replace(/^@/, "");
    const maxChannel = maxChan ? maxChan.value.trim() : "";
    const phoneVal = phoneInput ? phoneInput.value.trim() : "+7 (915) 318-18-19";
    const cleanDigits = phoneVal.replace(/[^\d+]/g, "");
    const showPhone = showPhoneCheckbox ? showPhoneCheckbox.checked : false;

    CatalogManager.updateProfile({
      telegramUsername: cleanTg,
      telegramChannelUrl: tgChannel,
      maxUsername: maxLogin,
      maxChannelUrl: maxChannel,
      phone: phoneVal,
      phoneClean: cleanDigits.startsWith("+") ? cleanDigits : ("+" + cleanDigits),
      showPhone: showPhone
    });

    this.closeContactsModal();
    if (typeof renderProfile === "function") {
      renderProfile();
    }
    showToast("Контакты и настройки ссылок обновлены! 📱✨");
    if (typeof SyncService !== "undefined") {
      SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
    }
  },

  // ==========================================
  // Обучающий тур для Люды (Tour Slider)
  // ==========================================
  currentTourSlide: 1,
  totalTourSlides: 4,

  openTour() {
    const modal = document.getElementById("tour-modal");
    if (!modal) return;
    this.goToTourSlide(1);
    modal.classList.add("open");
  },

  closeTour() {
    const modal = document.getElementById("tour-modal");
    if (modal) modal.classList.remove("open");
    CatalogManager.updateProfile({ hasSeenTour: true });
  },

  nextTourSlide() {
    if (this.currentTourSlide < this.totalTourSlides) {
      this.goToTourSlide(this.currentTourSlide + 1);
    } else {
      this.closeTour();
      showToast("Отлично! Приятной работы с витриной 🍰");
    }
  },

  prevTourSlide() {
    if (this.currentTourSlide > 1) {
      this.goToTourSlide(this.currentTourSlide - 1);
    }
  },

  goToTourSlide(step) {
    this.currentTourSlide = step;
    const slides = document.querySelectorAll(".tour-slide");
    slides.forEach((s) => {
      s.classList.toggle("active", parseInt(s.dataset.step, 10) === step);
    });

    const dots = document.querySelectorAll(".tour-dot");
    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === step - 1);
    });

    const prevBtn = document.getElementById("tour-btn-prev");
    const nextBtn = document.getElementById("tour-btn-next");
    const nextBtnText = document.getElementById("tour-btn-next-text");

    if (prevBtn) {
      prevBtn.style.display = step > 1 ? "inline-flex" : "none";
    }

    if (nextBtnText) {
      nextBtnText.textContent = step === this.totalTourSlides ? "Всё понятно, к витрине! ✨" : "Далее";
    } else if (nextBtn) {
      nextBtn.textContent = step === this.totalTourSlides ? "Всё понятно, к витрине! ✨" : "Далее →";
    }
  },

  // ==========================================
  // Интерактивные подсказки-«бублики» (Tooltips)
  // ==========================================
  tooltipsEnabled: true,

  toggleTooltips() {
    this.tooltipsEnabled = !this.tooltipsEnabled;
    const adminModal = document.getElementById("admin-modal");
    const btn = document.getElementById("btn-toggle-tooltips");

    if (adminModal) {
      adminModal.classList.toggle("hide-tooltips", !this.tooltipsEnabled);
    }
    if (btn) {
      btn.classList.toggle("active", this.tooltipsEnabled);
      btn.textContent = this.tooltipsEnabled ? "💡 Подсказки" : "💡 Подсказки: Выкл";
    }
    showToast(this.tooltipsEnabled ? "Подсказки включены 💡" : "Подсказки выключены 🔕");
  },

  showBubble(type, targetEl) {
    const popover = document.getElementById("tooltip-popover");
    const titleEl = document.getElementById("tooltip-popover-title");
    const textEl = document.getElementById("tooltip-popover-text");
    if (!popover || !titleEl || !textEl) return;

    const BUBBLE_TEXTS = {
      avatar: {
        title: "📸 Фото шеф-кондитера",
        text: "Здесь вы можете загрузить свою свежую фотографию из галереи телефона. Она сразу появится в шапке сайта для всех посетителей!"
      },
      add: {
        title: "✨ Добавить десерт",
        text: "Создать новый десерт: выберите категорию (пирожные, бенто или подарочные наборы), загрузите фото из галереи, укажите название и цену."
      },
      backup: {
        title: "💾 Резервная копия меню",
        text: "Скачивает на телефон файл со всеми вашими ценами, описаниями и добавленными десертами. Полезно сохранить перед большими изменениями."
      },
      pin: {
        title: "🔑 Смена PIN-кода",
        text: "Позволяет установить свой секретный код для входа (минимум 4 цифры) вместо стандартного 1819."
      },
      price: {
        title: "💰 Быстрая цена",
        text: "Нажмите прямо на цифру, введите новую цену и коснитесь экрана в любом месте — цена мгновенно обновится на сайте!"
      },
      status: {
        title: "🚦 Наличие десерта",
        text: "«В наличии» — клиенты могут заказать. «Закончился» — десерт останется на витрине, но с пометкой, и положить его в корзину будет нельзя."
      },
      contacts: {
        title: "📱 Контакты и мессенджеры",
        text: "Здесь вы можете изменить логин Telegram, канал, логин MAX Messenger, телефон, а также включить или выключить показ номера телефона на сайте для защиты от спам-ботов."
      }
    };

    const info = BUBBLE_TEXTS[type] || {
      title: "💡 Подсказка",
      text: "Нажмите на нужную кнопку для управления витриной."
    };

    titleEl.innerHTML = info.title;
    textEl.textContent = info.text;
    popover.classList.add("open");
  },

  hideBubble() {
    const popover = document.getElementById("tooltip-popover");
    if (popover) popover.classList.remove("open");
  }
};

window.AdminPanel = AdminPanel;
