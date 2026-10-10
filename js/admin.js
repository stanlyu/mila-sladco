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
    this.renderAdminList();
    modal.classList.add("open");
  },

  close() {
    const modal = document.getElementById("admin-modal");
    if (modal) modal.classList.remove("open");
    this.closeEditModal();
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
            </div>
          </div>
        </div>

        <div class="admin-item-actions">
          <button type="button" class="btn-admin-action ${p.isAvailable === false ? "btn-status-off" : "btn-status-on"}" 
            onclick="AdminPanel.toggleStatus('${p.id}')">
            ${p.isAvailable === false ? "❌ Закончился" : "✅ В наличии"}
          </button>
          
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
  },

  toggleStatus(id) {
    const newStatus = CatalogManager.toggleAvailability(id);
    this.renderAdminList();
    showToast(newStatus ? "Десерт снова на витрине!" : "Десерт скрыт с витрины (закончился)");
  },

  deleteProduct(id) {
    const product = CatalogManager.getProductById(id);
    if (!product) return;
    if (confirm(`Удалить десерт «${product.title}» из каталога?`)) {
      CatalogManager.deleteProduct(id);
      this.renderAdminList();
      showToast("Десерт удален");
    }
  },

  // Открытие формы добавления нового десерта
  openAddNew() {
    this.editingProductId = null;
    document.getElementById("edit-modal-title").textContent = "✨ Добавить новый десерт";
    document.getElementById("form-edit-title").value = "";
    document.getElementById("form-edit-price").value = "450";
    document.getElementById("form-edit-weight").value = "110 г";
    document.getElementById("form-edit-cat").value = "pastry";
    document.getElementById("form-edit-badge").value = "Новинка";
    document.getElementById("form-edit-desc").value = "";
    document.getElementById("form-edit-ingredients").value = "";
    document.getElementById("form-edit-preview-img").src = "assets/images/mango-passion.jpg";
    document.getElementById("form-edit-image-url").value = "assets/images/mango-passion.jpg";

    document.getElementById("admin-edit-modal").classList.add("open");
  },

  // Открытие формы редактирования существующего десерта
  openEditProduct(id) {
    const product = CatalogManager.getProductById(id);
    if (!product) return;

    this.editingProductId = id;
    document.getElementById("edit-modal-title").textContent = `✏️ Редактирование: ${product.title}`;
    document.getElementById("form-edit-title").value = product.title;
    document.getElementById("form-edit-price").value = product.price;
    document.getElementById("form-edit-weight").value = product.weight || "110 г";
    document.getElementById("form-edit-cat").value = product.category || "pastry";
    document.getElementById("form-edit-badge").value = product.badge || "";
    document.getElementById("form-edit-desc").value = product.fullDesc || product.shortDesc || "";
    document.getElementById("form-edit-ingredients").value = product.ingredients || "";
    document.getElementById("form-edit-preview-img").src = product.image;
    document.getElementById("form-edit-image-url").value = product.image;

    document.getElementById("admin-edit-modal").classList.add("open");
  },

  closeEditModal() {
    const modal = document.getElementById("admin-edit-modal");
    if (modal) modal.classList.remove("open");
    this.editingProductId = null;
  },

  // Загрузка фото с телефона/компьютера
  handleImageUpload(input) {
    if (input.files && input.files[0]) {
      const file = input.files[0];
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
    const price = parseInt(document.getElementById("form-edit-price").value, 10);
    const weight = document.getElementById("form-edit-weight").value.trim();
    const category = document.getElementById("form-edit-cat").value;
    const badge = document.getElementById("form-edit-badge").value.trim();
    const desc = document.getElementById("form-edit-desc").value.trim();
    const ingredients = document.getElementById("form-edit-ingredients").value.trim();
    const image = document.getElementById("form-edit-image-url").value;

    if (!title) {
      showToast("Пожалуйста, введите название десерта");
      return;
    }

    if (isNaN(price) || price <= 0) {
      showToast("Укажите правильную цену");
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
  },

  // Смена PIN-кода Людой
  promptChangePin() {
    const oldPin = prompt("Введите текущий PIN-код (по умолчанию 1414):");
    if (!oldPin) return;
    const newPin = prompt("Введите новый PIN-код (минимум 4 цифры):");
    if (!newPin) return;

    const res = AuthSecurity.changePin(oldPin, newPin);
    if (res.success) {
      showToast("PIN-код успешно изменен! 🔐");
    } else {
      showToast(res.message);
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

  // Сброс к заводским десертам
  resetDefaults() {
    if (confirm("Вы точно хотите вернуть стандартные десерты? Все ваши добавленные десерты сбросятся.")) {
      CatalogManager.resetToDefaults();
      this.renderAdminList();
      showToast("Меню сброшено до стандартного");
    }
  }
};

window.AdminPanel = AdminPanel;
