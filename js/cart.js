/**
 * Управление корзиной Mila_sladco
 */
const Cart = {
  items: [],
  catalogSource: null,
  STORAGE_KEY: "mila_sladco_cart_v1",
  STORAGE_TIME_KEY: "mila_sladco_cart_timestamp",
  SESSION_KEY: "mila_sladco_cart_session_active",
  SESSION_TTL_MS: 2 * 60 * 60 * 1000, // 2 часа актуальности корзины

  init(customCatalog = null) {
    if (customCatalog) {
      this.catalogSource = customCatalog;
    }

    let isStale = false;
    try {
      if (typeof sessionStorage !== "undefined") {
        if (!sessionStorage.getItem(this.SESSION_KEY)) {
          // Новая вкладка или свежая сессия браузера — сбрасываем старую корзину
          isStale = true;
          sessionStorage.setItem(this.SESSION_KEY, "active");
        }
      }
      if (typeof localStorage !== "undefined") {
        const savedTime = parseInt(localStorage.getItem(this.STORAGE_TIME_KEY) || "0", 10);
        if (savedTime && Date.now() - savedTime > this.SESSION_TTL_MS) {
          isStale = true;
        }
      }
    } catch (e) {
      console.warn("Ошибка проверки сессии корзины", e);
    }

    if (isStale) {
      this.clear();
      return;
    }

    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          this.items = JSON.parse(saved);
        }
      }
    } catch (e) {
      console.warn("Не удалось прочитать корзину из LocalStorage", e);
      this.items = [];
    }
    this.notify();
  },

  save() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
        localStorage.setItem(this.STORAGE_TIME_KEY, Date.now().toString());
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(this.SESSION_KEY, "active");
      }
    } catch (e) {
      console.warn("Не удалось сохранить корзину", e);
    }
    this.notify();
  },

  getProduct(productId) {
    if (this.catalogSource && typeof this.catalogSource.getProductById === "function") {
      return this.catalogSource.getProductById(productId);
    }
    if (typeof CatalogManager !== "undefined" && typeof CatalogManager.getProductById === "function") {
      return CatalogManager.getProductById(productId);
    }
    if (typeof PRODUCTS !== "undefined") {
      return PRODUCTS.find((p) => p.id === productId);
    }
    return null;
  },

  addItem(productId, quantity = 1) {
    const product = this.getProduct(productId);
    if (!product) return false;

    // Проверка наличия: нельзя заказать десерт, которого нет в наличии
    if (product.isAvailable === false) {
      return false;
    }

    const existingIndex = this.items.findIndex((item) => item.id === productId);
    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        id: product.id,
        title: product.title,
        price: product.price,
        weight: product.weight,
        image: product.image,
        quantity: quantity
      });
    }
    this.save();
    return true;
  },

  updateQuantity(productId, delta) {
    const itemIndex = this.items.findIndex((item) => item.id === productId);
    if (itemIndex === -1) return;

    this.items[itemIndex].quantity += delta;
    if (this.items[itemIndex].quantity <= 0) {
      this.items.splice(itemIndex, 1);
    }
    this.save();
  },

  removeItem(productId) {
    this.items = this.items.filter((item) => item.id !== productId);
    this.save();
  },

  clear() {
    this.items = [];
    this.save();
  },

  getTotalCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getTotalPrice() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  notify() {
    if (typeof document !== "undefined" && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent("cart:updated", {
        detail: {
          items: this.items,
          totalCount: this.getTotalCount(),
          totalPrice: this.getTotalPrice()
        }
      }));
    }
  },

  /**
   * Генерация сообщения заказа для отправки в мессенджеры
   */
  generateOrderText(formData) {
    const dateStr = formData.date || "Как можно скорее";
    const timeStr = formData.time ? ` (${formData.time})` : "";
    const deliveryMethod = formData.deliveryType === "pickup" ? "🚶 Самовывоз (Москва, м. Раменки)" : `🚚 Доставка: ${formData.address || "Адрес согласуем"}`;
    
    let text = `🍰 *НОВЫЙ ЗАКАЗ — Mila_sladco*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `*Выбранные десерты:*\n`;

    this.items.forEach((item, index) => {
      text += `${index + 1}. *${item.title}*\n`;
      text += `   • ${item.quantity} шт. × ${item.price} ₽ = *${item.quantity * item.price} ₽*\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 *ИТОГО К ОПЛАТЕ: ${this.getTotalPrice()} ₽*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `📋 *Данные клиента:*\n`;
    text += `👤 Имя: ${formData.name || "Гость"}\n`;
    text += `📱 Телефон / ник: ${formData.phone || "Не указан"}\n`;
    text += `🗓 Желаемая дата: ${dateStr}${timeStr}\n`;
    text += `📍 Способ получения: ${deliveryMethod}\n`;

    if (formData.comment && formData.comment.trim()) {
      text += `💌 Пожелания / надпись: «${formData.comment.trim()}»\n`;
    }

    text += `\n💬 Связь через: ${formData.messenger === "max" ? "MAX" : "Telegram"}\n`;
    text += `_Заказ отправлен через витрину mila-sladco_`;

    return text;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Cart };
} else {
  window.Cart = Cart;
}
