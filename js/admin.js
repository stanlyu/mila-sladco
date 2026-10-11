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

  hasUnpublishedChanges: false,
  isSyncing: false,
  lastPublishedTime: null,

  checkUnpublishedChanges() {
    let hasChanges = false;
    if (typeof CatalogManager !== "undefined" && typeof CatalogManager.hasActualChanges === "function") {
      hasChanges = CatalogManager.hasActualChanges();
    } else {
      hasChanges = Boolean(this.hasUnpublishedChanges);
    }
    this.hasUnpublishedChanges = hasChanges;
    if (hasChanges) {
      this.setSyncState("pending");
    } else {
      this.setSyncState("synced");
    }
    return hasChanges;
  },

  markUnpublishedChanges() {
    if (typeof CatalogManager !== "undefined" && typeof CatalogManager.hasActualChanges === "function") {
      return this.checkUnpublishedChanges();
    }
    this.hasUnpublishedChanges = true;
    this.setSyncState("pending");
    return true;
  },

  setSyncState(state, message) {
    const dot = document.getElementById("sync-status-dot");
    const text = document.getElementById("sync-status-text");
    const btn = document.getElementById("btn-admin-publish");
    const bar = document.getElementById("admin-sync-bar");

    if (dot) {
      dot.className = "sync-dot";
      if (state === "syncing") dot.classList.add("syncing");
      if (state === "pending") dot.classList.add("pending");
    }

    if (bar) {
      if (state === "pending") {
        bar.classList.add("has-pending");
      } else {
        bar.classList.remove("has-pending");
      }
    }

    if (text) {
      if (message) {
        text.textContent = message;
      } else if (state === "syncing") {
        text.textContent = "⏳ Публикация на сайт...";
      } else if (state === "pending") {
        text.textContent = "⚠️ Есть несохранённые изменения";
      } else {
        const timeStr = this.lastPublishedTime ? ` (${this.lastPublishedTime})` : "";
        text.textContent = `🟢 Все изменения опубликованы на сайте${timeStr}`;
      }
    }

    if (btn) {
      btn.disabled = (state === "syncing");
      btn.textContent = (state === "syncing") ? "⏳ Публикуем..." : "🚀 Опубликовать";
      if (state === "pending") {
        btn.classList.add("pending-highlight");
      } else {
        btn.classList.remove("pending-highlight");
      }
    }
  },

  async syncToCloud() {
    this.isSyncing = true;
    this.setSyncState("syncing");

    if (typeof SyncService !== "undefined") {
      try {
        const res = await SyncService.pushToRemote(CatalogManager.getProducts(), CatalogManager.getProfile());
        if (res && res.success) {
          if (typeof CatalogManager !== "undefined" && typeof CatalogManager.commitPublishedSnapshot === "function") {
            CatalogManager.commitPublishedSnapshot();
          }
          this.hasUnpublishedChanges = false;
          this.lastPublishedTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          this.setSyncState("synced");
          return true;
        } else {
          this.setSyncState("pending", "⚠️ Ошибка связи с сервером");
          return false;
        }
      } catch (e) {
        this.setSyncState("pending", "⚠️ Ошибка сети при синхронизации");
        return false;
      } finally {
        this.isSyncing = false;
      }
    }
    if (typeof CatalogManager !== "undefined" && typeof CatalogManager.commitPublishedSnapshot === "function") {
      CatalogManager.commitPublishedSnapshot();
    }
    this.hasUnpublishedChanges = false;
    this.setSyncState("synced");
    return true;
  },

  async manualPublish() {
    if (this.isSyncing) return;
    showToast("Публикуем изменения на сайт... 🚀");
    const ok = await this.syncToCloud();
    if (ok) {
      showToast("🎉 Все изменения успешно опубликованы! Клиенты видят обновленный сайт.", 4500);
    } else {
      showToast("Не удалось опубликовать. Проверьте интернет-соединение.", 4000);
    }
  },

  // Открытие модального окна выхода с предупреждением
  openUnsavedExitModal() {
    const modal = document.getElementById("admin-unsaved-exit-modal");
    if (modal) modal.classList.add("open");
  },

  closeUnsavedExitModal() {
    const modal = document.getElementById("admin-unsaved-exit-modal");
    if (modal) modal.classList.remove("open");
  },

  confirmDiscardAndExit() {
    if (typeof CatalogManager !== "undefined" && typeof CatalogManager.discardUnpublishedChanges === "function") {
      CatalogManager.discardUnpublishedChanges();
    }
    this.hasUnpublishedChanges = false;
    this.setSyncState("synced");
    this.closeUnsavedExitModal();
    this.close(true);
    showToast("Изменения отменены. Вы вышли из кабинета");
  },

  async publishAndExit() {
    showToast("Публикуем изменения на сайт... 🚀");
    const ok = await this.syncToCloud();
    if (ok) {
      this.closeUnsavedExitModal();
      this.close(true);
      showToast("🎉 Изменения опубликованы, витрина обновлена!", 4000);
    } else {
      showToast("Не удалось опубликовать. Проверьте интернет-соединение.", 4000);
    }
  },

  // Выход из сессии кондитера
  logout() {
    if (this.checkUnpublishedChanges() || this.isSyncing) {
      this.openUnsavedExitModal();
      return;
    }
    AuthSecurity.logout();
    this.close(true);
    showToast("Вы вышли из режима кондитера 🔒");
  },

  open() {
    const modal = document.getElementById("admin-modal");
    if (!modal) return;
    this.updateChefAvatarPreview();
    this.renderAdminList();
    this.checkUnpublishedChanges();
    modal.classList.add("open");

    // Если Люда впервые в кабинете — запускаем интерактивный тур
    const profile = CatalogManager.getProfile();
    if (profile && !profile.hasSeenTour) {
      setTimeout(() => this.openTour(), 400);
    }
  },

  close(force = false) {
    if (!force && (this.checkUnpublishedChanges() || this.isSyncing)) {
      this.openUnsavedExitModal();
      return;
    }
    const modal = document.getElementById("admin-modal");
    if (modal) modal.classList.remove("open");
    this.closeEditModal();
    this.closeContactsModal();
    this.closeUnsavedExitModal();
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
          this.markUnpublishedChanges();
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
        this.markUnpublishedChanges();
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
    this.markUnpublishedChanges();
  },

  toggleStatus(id) {
    const newStatus = CatalogManager.toggleAvailability(id);
    this.renderAdminList();
    showToast(newStatus ? "Десерт снова на витрине!" : "Десерт скрыт с витрины (закончился)");
    this.markUnpublishedChanges();
  },

  deleteProduct(id) {
    const product = CatalogManager.getProductById(id);
    if (!product) return;
    if (confirm(`Удалить десерт «${product.title}» из каталога?`)) {
      CatalogManager.deleteProduct(id);
      this.renderAdminList();
      showToast("Десерт удален");
      this.markUnpublishedChanges();
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
    this.markUnpublishedChanges();
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
      this.markUnpublishedChanges();
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
      this.markUnpublishedChanges();
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
    
    // Очищаем поля и ошибки
    for (let i = 0; i < 7; i++) {
      const input = document.getElementById(`rec-q-${i}`);
      if (input) {
        input.value = "";
        input.classList.remove("input-error");
      }
    }
    const titleEl = document.getElementById("pin-recovery-title");
    const subtitleEl = document.getElementById("pin-recovery-subtitle");
    if (titleEl) titleEl.textContent = "Восстановление доступа";
    if (subtitleEl) subtitleEl.textContent = "Для подтверждения личности кондитера ответьте на контрольные вопросы:";

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
    for (let i = 0; i < 7; i++) {
      const input = document.getElementById(`rec-q-${i}`);
      if (input) input.classList.remove("input-error");
    }

    const answers = [];
    for (let i = 0; i < 7; i++) {
      const input = document.getElementById(`rec-q-${i}`);
      answers.push(input ? input.value : "");
    }

    const errBox = document.getElementById("recovery-error-box");
    const res = AuthSecurity.verifyAllSecurityQuestions(answers);

    if (res.success) {
      if (errBox) {
        errBox.textContent = "";
        errBox.style.display = "none";
      }
      const titleEl = document.getElementById("pin-recovery-title");
      const subtitleEl = document.getElementById("pin-recovery-subtitle");
      if (titleEl) titleEl.textContent = "Личность подтверждена! 🎉";
      if (subtitleEl) subtitleEl.textContent = "Ваш PIN-код успешно сброшен до 1819";

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
        if (failInput) {
          failInput.classList.add("input-error");
          if (typeof failInput.focus === "function") failInput.focus();
        }
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

  // Вспомогательный сброс ошибок ввода
  clearInputError(input) {
    const el = typeof input === "string" ? document.getElementById(input) : input;
    if (el) {
      el.classList.remove("input-error");
      const errEl = document.getElementById(`error-${el.id}`);
      if (errEl) {
        errEl.textContent = "";
        errEl.style.display = "none";
      }
    }
    const recErr = document.getElementById("recovery-error-box");
    if (recErr && recErr.style.display !== "none") {
      recErr.textContent = "";
      recErr.style.display = "none";
    }
  },

  // ==========================================
  // Управление контактами и ссылками
  // ==========================================
  openContactsModal() {
    const modal = document.getElementById("contacts-modal");
    if (!modal) return;

    // Сброс предыдущих ошибок
    ["setting-phone", "setting-tg-user", "setting-max-user", "setting-tg-channel", "setting-max-channel", "setting-pickup-address"].forEach((id) => {
      this.clearInputError(id);
    });

    const profile = CatalogManager.getProfile() || {};
    const tgUser = document.getElementById("setting-tg-user");
    const tgChan = document.getElementById("setting-tg-channel");
    const maxUser = document.getElementById("setting-max-user");
    const maxChan = document.getElementById("setting-max-channel");
    const pickupInput = document.getElementById("setting-pickup-address");
    const phoneInput = document.getElementById("setting-phone");
    const showPhoneCheckbox = document.getElementById("setting-show-phone");

    const showTgDirectCb = document.getElementById("setting-show-tg-direct");
    const showMaxDirectCb = document.getElementById("setting-show-max-direct");
    const showTgChanCb = document.getElementById("setting-show-tg-channel");
    const showMaxChanCb = document.getElementById("setting-show-max-channel");

    if (tgUser) tgUser.value = profile.telegramUsername || "";
    if (tgChan) tgChan.value = profile.telegramChannelUrl || "";
    if (maxUser) maxUser.value = profile.maxUsername || "";
    if (maxChan) maxChan.value = profile.maxChannelUrl || "";
    if (pickupInput) pickupInput.value = profile.pickupAddress || "Москва, м. Раменки";
    
    const rawPhone = profile.phone || "+7 (915) 318-18-19";
    if (phoneInput) {
      const formatFn = typeof formatPhoneNumber === "function" ? formatPhoneNumber : (typeof window !== "undefined" && window.formatPhoneNumber ? window.formatPhoneNumber : null);
      phoneInput.value = formatFn ? formatFn(rawPhone) : rawPhone;
    }
    if (showPhoneCheckbox) showPhoneCheckbox.checked = Boolean(profile.showPhone);

    if (showTgDirectCb) showTgDirectCb.checked = profile.showTelegramDirect !== false;
    if (showMaxDirectCb) showMaxDirectCb.checked = profile.showMaxDirect !== false;
    if (showTgChanCb) showTgChanCb.checked = profile.showTelegramChannel !== false;
    if (showMaxChanCb) showMaxChanCb.checked = Boolean(profile.showMaxChannel);

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
    const pickupInput = document.getElementById("setting-pickup-address");
    const phoneInput = document.getElementById("setting-phone");
    const showPhoneCheckbox = document.getElementById("setting-show-phone");

    const showTgDirectCb = document.getElementById("setting-show-tg-direct");
    const showMaxDirectCb = document.getElementById("setting-show-max-direct");
    const showTgChanCb = document.getElementById("setting-show-tg-channel");
    const showMaxChanCb = document.getElementById("setting-show-max-channel");

    // Сброс предыдущих ошибок
    ["setting-phone", "setting-tg-user", "setting-max-user", "setting-tg-channel", "setting-max-channel", "setting-pickup-address"].forEach((id) => {
      this.clearInputError(id);
    });

    const cleanTg = (tgUser && tgUser.value ? String(tgUser.value).trim() : "").replace(/^@/, "");
    const tgChannel = (tgChan && tgChan.value) ? String(tgChan.value).trim() : "";
    let maxLogin = (maxUser && maxUser.value ? String(maxUser.value).trim() : "").replace(/^@/, "");
    const maxUrlMatch = maxLogin.match(/https?:\/\/[^\s]+/i);
    if (maxUrlMatch) {
      maxLogin = maxUrlMatch[0];
    }
    const maxChannel = (maxChan && maxChan.value) ? String(maxChan.value).trim() : "";
    const pickupVal = (pickupInput && pickupInput.value) ? String(pickupInput.value).trim() : "";
    const phoneVal = (phoneInput && phoneInput.value) ? String(phoneInput.value).trim() : "";
    const showPhone = showPhoneCheckbox ? Boolean(showPhoneCheckbox.checked) : false;

    const showTgDirect = showTgDirectCb ? showTgDirectCb.checked : false;
    const showMaxDirect = showMaxDirectCb ? showMaxDirectCb.checked : false;
    const showTgChannel = showTgChanCb ? showTgChanCb.checked : false;
    const showMaxChannel = showMaxChanCb ? showMaxChanCb.checked : false;

    const errors = [];
    let firstInvalidField = null;

    const markError = (id, msg) => {
      const el = document.getElementById(id);
      const errEl = document.getElementById(`error-${id}`);
      if (el) el.classList.add("input-error");
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = "block";
      }
      if (!firstInvalidField && el) firstInvalidField = el;
      errors.push(msg);
    };

    // Валидатор телефона
    const validatePhoneFn = typeof validatePhoneNumber === "function" ? validatePhoneNumber : (typeof window !== "undefined" && window.validatePhoneNumber ? window.validatePhoneNumber : (p) => p.replace(/\D/g, "").length === 11);

    if (showPhone && !phoneVal) {
      markError("setting-phone", "Укажите рабочий телефон для приёма звонков");
    } else if (phoneVal && !validatePhoneFn(phoneVal)) {
      markError("setting-phone", "Укажите корректный номер телефона (11 цифр)");
    }

    if (showTgDirect) {
      if (!cleanTg) {
        markError("setting-tg-user", "Укажите ник Telegram для связи");
      } else if (/\s/.test(cleanTg) || cleanTg.includes("/")) {
        markError("setting-tg-user", "Ник Telegram не должен содержать пробелов или слэшей");
      }
    }

    if (showMaxDirect) {
      if (!maxLogin) {
        markError("setting-max-user", "Укажите ссылку-приглашение из приложения MAX");
      } else if (!maxLogin.includes("max.ru") && !maxLogin.startsWith("+") && maxLogin.length < 3) {
        markError("setting-max-user", "Вставьте ссылку вида https://max.ru/u/... или контакт");
      }
    }

    if (showTgChannel) {
      if (!tgChannel) {
        markError("setting-tg-channel", "Укажите ссылку на Telegram-канал");
      } else if (!tgChannel.startsWith("http") && !tgChannel.startsWith("t.me") && !tgChannel.startsWith("@")) {
        markError("setting-tg-channel", "Ссылка должна начинаться с https://t.me/ или @");
      }
    }

    if (showMaxChannel) {
      if (!maxChannel) {
        markError("setting-max-channel", "Укажите ссылку на MAX-канал");
      } else if (!maxChannel.startsWith("http")) {
        markError("setting-max-channel", "Укажите корректную ссылку на канал (https://...)");
      }
    }

    if (!pickupVal || pickupVal.length < 5) {
      markError("setting-pickup-address", "Укажите точный адрес для самовывоза (минимум 5 символов)");
    }

    if (errors.length > 0) {
      if (firstInvalidField && typeof firstInvalidField.focus === "function") firstInvalidField.focus();
      showToast("Пожалуйста, исправьте ошибки в настройках контактов ⚠️", 3500);
      return false;
    }

    const cleanDigits = phoneVal.replace(/[^\d+]/g, "");

    CatalogManager.updateProfile({
      telegramUsername: cleanTg,
      telegramChannelUrl: tgChannel,
      maxUsername: maxLogin,
      maxChannelUrl: maxChannel,
      pickupAddress: pickupVal,
      showTelegramDirect: showTgDirect,
      showMaxDirect: showMaxDirect,
      showTelegramChannel: showTgChannel,
      showMaxChannel: showMaxChannel,
      phone: phoneVal,
      phoneClean: cleanDigits.startsWith("+") ? cleanDigits : ("+" + cleanDigits),
      showPhone: showPhone
    });

    this.closeContactsModal();
    if (typeof renderProfile === "function") {
      renderProfile();
    }
    showToast("Контакты и настройки ссылок обновлены! 📱✨");
    this.markUnpublishedChanges();
    return true;
  },

  // ==========================================
  // Обучающий тур для Люды (Tour Slider)
  // ==========================================
  currentTourSlide: 1,
  totalTourSlides: 5,

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
        text: "Здесь вы можете настроить логины Telegram и MAX, ссылки на каналы, телефон и адрес для самовывоза."
      },
      tg_user: {
        title: "✈️ Личный Telegram для заказов",
        text: "Укажите ваш логин (username) в Telegram без знака @, например: mila_sladco.\n\nКлиент нажмёт кнопку «Написать в Telegram» на сайте и сразу перейдёт в личный диалог с вами для отправки заказа или вопроса."
      },
      max_user: {
        title: "💬 Ссылка на диалог в MAX",
        text: "Где скопировать вашу персональную ссылку в MAX:\n\n📱 В мобильном приложении: откройте «Настройки» (шестерёнка) ➔ «Пригласить друзей» ➔ «Скопировать ссылку».\n\n💻 В приложении на компьютере: откройте профиль / настройки ➔ нажмите «Скопировать ссылку».\n\nСсылка имеет вид https://max.ru/u/... — вставьте её сюда целиком. По ней клиенты сразу попадают в личный диалог с вами."
      },
      pickup_address: {
        title: "📍 Адрес для самовывоза",
        text: "Укажите точный адрес или ориентир (город, улица, дом, метро), где клиенты могут забрать готовый заказ.\n\nЭтот адрес автоматически появится в корзине при выборе самовывоза и попадёт в готовый чек заказа."
      },
      tg_channel: {
        title: "📢 Telegram-канал",
        text: "Ссылка на ваш канал в Telegram с новостями, фото новинок и анонсами кондитерской (например: https://t.me/mila_sladco1 или ссылка-приглашение)."
      },
      max_channel: {
        title: "📢 Канал в MAX Messenger",
        text: "Ссылка-приглашение на ваш канал в мессенджере MAX (имеет вид https://max.ru/join/...).\n\nКлиенты смогут подписаться на новости прямо из визитки сайта."
      },
      phone: {
        title: "📞 Рабочий номер телефона",
        text: "Рабочий контактный номер кондитерской для связи с клиентами.\n\n💡 Рекомендация: используйте отдельный рабочий номер для заказов, а не личный семейный номер."
      },
      phone_protect: {
        title: "🛡️ Защита номера от ботов и спама",
        text: "Встроенный анти-бот фильтр:\n\nНомер скрыт от автоматических роботов, парсеров и автодозвонщиков. Чтобы позвонить, гость нажимает кнопку и проходит быстрый человеческий тест (выбрать десерт среди картинок)."
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { AdminPanel };
}
