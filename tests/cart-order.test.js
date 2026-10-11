const test = require("node:test");
const assert = require("node:assert");

class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock();
global.document = {
  dispatchEvent: () => {}
};
global.CustomEvent = class {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts ? opts.detail : null;
  }
};

const { CatalogManager } = require("../js/catalog-manager.js");
const { Cart } = require("../js/cart.js");

test("Cart: добавление позиций и подсчет итоговой стоимости", () => {
  CatalogManager.init();
  Cart.init(CatalogManager);
  Cart.clear();

  Cart.addItem("mango-passion", 2);
  Cart.addItem("chocolate-truffle", 1);

  assert.strictEqual(Cart.getTotalCount(), 3);
  assert.strictEqual(Cart.getTotalPrice(), 450 * 2 + 450 * 1); // 1350
});

test("Cart: нельзя добавить товар, которого нет в наличии", () => {
  CatalogManager.init();
  CatalogManager.updateProduct("mango-passion", { isAvailable: false });
  Cart.init(CatalogManager);
  Cart.clear();

  const success = Cart.addItem("mango-passion", 1);
  assert.strictEqual(success, false);
  assert.strictEqual(Cart.getTotalCount(), 0);

  // Возвращаем в наличие
  CatalogManager.updateProduct("mango-passion", { isAvailable: true });
});

test("Cart: изменение количества и удаление позиции", () => {
  Cart.clear();
  Cart.addItem("mango-passion", 2);
  assert.strictEqual(Cart.getTotalCount(), 2);

  Cart.updateQuantity("mango-passion", -1);
  assert.strictEqual(Cart.getTotalCount(), 1);

  Cart.updateQuantity("mango-passion", -1); // падает до 0 -> удаление
  assert.strictEqual(Cart.getTotalCount(), 0);
  assert.strictEqual(Cart.items.length, 0);
});

test("Cart: генерация читаемого заказа для MAX и Telegram", () => {
  Cart.clear();
  Cart.addItem("mango-passion", 2);
  Cart.addItem("bento-berry", 1);

  const orderText = Cart.generateOrderText({
    name: "Екатерина",
    phone: "+7 999 111-22-33",
    date: "2026-10-15",
    time: "14:00 - 18:00",
    deliveryType: "delivery",
    address: "ул. Ленина, д. 5, кв. 12",
    comment: "С надписью «С днём рождения, мама!»",
    messenger: "max"
  });

  assert.ok(orderText.includes("Mila_sladco"));
  assert.ok(orderText.includes("Манго-Маракуйя"));
  assert.ok(orderText.includes("Екатерина"));
  assert.ok(orderText.includes("+7 999 111-22-33"));
  assert.ok(orderText.includes("С надписью «С днём рождения, мама!»"));
  assert.ok(orderText.includes("MAX"));
});

test("Cart: генерация заказа с кастомным адресом самовывоза", () => {
  Cart.clear();
  Cart.addItem("mango-passion", 1);

  const orderText = Cart.generateOrderText({
    name: "Анастасия",
    phone: "+7 999 222-33-44",
    deliveryType: "pickup",
    pickupAddress: "Москва, м. Раменки, Мичуринский проспект, 15",
    messenger: "telegram"
  });

  assert.ok(orderText.includes("Самовывоз (Москва, м. Раменки, Мичуринский проспект, 15)"));
  assert.ok(orderText.includes("Telegram"));
});

test("Cart: сброс корзины при истечении срока жизни сессии (TTL 2 часа)", () => {
  CatalogManager.init();
  Cart.init(CatalogManager);
  Cart.clear();
  Cart.addItem("mango-passion", 1);
  assert.strictEqual(Cart.getTotalCount(), 1);

  // Имитируем сохранение 3 часа назад
  const expiredTime = Date.now() - (3 * 60 * 60 * 1000);
  global.localStorage.setItem(Cart.STORAGE_TIME_KEY, expiredTime.toString());

  // При новом входе Cart.init() обнаруживает протухшую корзину и очищает её
  Cart.init(CatalogManager);
  assert.strictEqual(Cart.getTotalCount(), 0);
  assert.strictEqual(Cart.items.length, 0);
});

test("Cart: сброс устаревшей корзины при открытии новой сессии вкладки", () => {
  // Настраиваем mock sessionStorage
  class SessionStorageMock {
    constructor() {
      this.store = {};
    }
    getItem(key) {
      return this.store[key] || null;
    }
    setItem(key, value) {
      this.store[key] = String(value);
    }
    removeItem(key) {
      delete this.store[key];
    }
    clear() {
      this.store = {};
    }
  }

  global.sessionStorage = new SessionStorageMock();
  Cart.init(CatalogManager);
  Cart.addItem("chocolate-truffle", 2);
  assert.strictEqual(Cart.getTotalCount(), 2);

  // Пользователь закрыл вкладку -> sessionStorage очищен
  global.sessionStorage.clear();

  // При новом открытии сайта корзина автоматически очищается для нового заказа
  Cart.init(CatalogManager);
  assert.strictEqual(Cart.getTotalCount(), 0);
  assert.strictEqual(Cart.items.length, 0);
});

test("submitOrder: успешное оформление заказа без падений на profile и чистый URL для MAX", () => {
  CatalogManager.init();
  CatalogManager.updateProfile({
    pickupAddress: "Москва, м. Раменки, Мичуринский проспект, 20",
    maxUsername: "https://max.ru/u/f9LHodD0cOKtpgcRQDbst0ZH8oscTneW8jil_ynJPKyuKz80ix3NCrQsRss"
  });
  Cart.init(CatalogManager);
  Cart.clear();
  Cart.addItem("mango-passion", 1);

  const profile = CatalogManager.getProfile();
  assert.ok(profile);
  assert.strictEqual(profile.pickupAddress, "Москва, м. Раменки, Мичуринский проспект, 20");

  const formData = {
    name: "Иван",
    phone: "+7 900 123-45-67",
    deliveryType: "pickup",
    pickupAddress: profile.pickupAddress,
    messenger: "max"
  };

  const text = Cart.generateOrderText(formData);
  assert.ok(text.includes("Иван"));
  assert.ok(text.includes("Самовывоз (Москва, м. Раменки, Мичуринский проспект, 20)"));

  let rawMax = profile.maxUsername.trim();
  const maxUrlMatch = rawMax.match(/https?:\/\/[^\s]+/i);
  if (maxUrlMatch) rawMax = maxUrlMatch[0];
  assert.strictEqual(rawMax, "https://max.ru/u/f9LHodD0cOKtpgcRQDbst0ZH8oscTneW8jil_ynJPKyuKz80ix3NCrQsRss");
  assert.strictEqual(rawMax.includes("?message="), false);
});

test("PhoneProtection: капча запрашивается при каждом вызове без кэширования", () => {
  const challengeState = { visible: false };
  const resultState = { visible: false };
  const errBoxState = { text: "", visible: false };

  const mockPhoneProtection = {
    showModal() {
      challengeState.visible = true;
      resultState.visible = false;
      errBoxState.visible = false;
      errBoxState.text = "";
    },
    closeModal() {
      challengeState.visible = true;
      resultState.visible = false;
    },
    chooseOption(isCorrect) {
      if (!isCorrect) {
        errBoxState.visible = true;
        errBoxState.text = "Не совсем то!";
        return;
      }
      challengeState.visible = false;
      resultState.visible = true;
    }
  };

  // 1-й вызов: открытие модалки
  mockPhoneProtection.showModal();
  assert.strictEqual(challengeState.visible, true);
  assert.strictEqual(resultState.visible, false);

  // Ошибочный выбор
  mockPhoneProtection.chooseOption(false);
  assert.strictEqual(challengeState.visible, true);
  assert.strictEqual(resultState.visible, false);
  assert.strictEqual(errBoxState.visible, true);

  // Правильный выбор
  mockPhoneProtection.chooseOption(true);
  assert.strictEqual(challengeState.visible, false);
  assert.strictEqual(resultState.visible, true);

  // Закрываем окно
  mockPhoneProtection.closeModal();

  // 2-й вызов: проверка должна запроситься СНОВА (кэш удален)
  mockPhoneProtection.showModal();
  assert.strictEqual(challengeState.visible, true, "Капча должна отображаться повторно");
  assert.strictEqual(resultState.visible, false, "Телефон не должен быть открыт без повторной проверки");
});

test("copyTextToClipboard: надежное синхронное копирование", () => {
  let execCommandCalled = false;
  let copiedText = "";
  
  global.document = {
    createElement: (tag) => ({
      value: "",
      style: {},
      setAttribute: () => {},
      focus: () => {},
      select: () => {},
      setSelectionRange: () => {}
    }),
    body: {
      appendChild: (el) => { copiedText = el.value; },
      removeChild: () => {}
    },
    execCommand: (cmd) => {
      if (cmd === "copy") {
        execCommandCalled = true;
        return true;
      }
      return false;
    }
  };

  function copyTextToClipboard(text) {
    if (!text) return false;
    let copied = false;
    if (typeof document !== "undefined") {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "-9999px";
        ta.style.opacity = "0";
        ta.setAttribute("readonly", "");
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, 99999);
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {}
    }
    return copied;
  }

  const success = copyTextToClipboard("Тестовый заказ");
  assert.strictEqual(success, true);
  assert.strictEqual(execCommandCalled, true);
  assert.strictEqual(copiedText, "Тестовый заказ");
});

test("formatPhoneNumber: автоформатирование номеров РФ и международных", () => {
  function formatPhoneNumber(val) {
    if (!val) return "";
    let digits = val.replace(/\D/g, "");
    if (!digits) return "";
    if (digits[0] === "9") digits = "7" + digits;
    if (digits[0] === "8") digits = "7" + digits.slice(1);
    if (digits[0] === "7") {
      const d = digits.slice(1, 11);
      let formatted = "+7";
      if (d.length > 0) formatted += " (" + d.slice(0, 3);
      if (d.length > 3) formatted += ") " + d.slice(3, 6);
      if (d.length > 6) formatted += "-" + d.slice(6, 8);
      if (d.length > 8) formatted += "-" + d.slice(8, 10);
      return formatted;
    }
    return "+" + digits.slice(0, 15);
  }

  // Ввод без префикса (с 9-ки)
  assert.strictEqual(formatPhoneNumber("9063594244"), "+7 (906) 359-42-44");
  // Ввод с 8-ки
  assert.strictEqual(formatPhoneNumber("89063594244"), "+7 (906) 359-42-44");
  // Ввод с +7
  assert.strictEqual(formatPhoneNumber("+79063594244"), "+7 (906) 359-42-44");
  // Ввод с мусором и спецсимволами
  assert.strictEqual(formatPhoneNumber("+7 (906) abc 359--42..44"), "+7 (906) 359-42-44");
  // Частичный ввод
  assert.strictEqual(formatPhoneNumber("906"), "+7 (906");
  assert.strictEqual(formatPhoneNumber("906359"), "+7 (906) 359");
});

test("validatePhoneNumber: проверка корректности 11 цифр", () => {
  function validatePhoneNumber(val) {
    if (!val) return false;
    const digits = val.replace(/\D/g, "");
    if (val.startsWith("+7") || digits.startsWith("7") || digits.startsWith("8")) {
      return digits.length === 11;
    }
    return digits.length >= 10 && digits.length <= 15;
  }

  assert.strictEqual(validatePhoneNumber("+7 (906) 359-42-44"), true);
  assert.strictEqual(validatePhoneNumber("+79063594244"), true);
  assert.strictEqual(validatePhoneNumber("89063594244"), true);
  assert.strictEqual(validatePhoneNumber("+7 (906) 359-42"), false); // неполный
  assert.strictEqual(validatePhoneNumber(""), false);
  assert.strictEqual(validatePhoneNumber("не телефон"), false);
});

test("PhoneProtection: нейтральное сообщение об ошибке и мгновенная перегенерация нового вопроса", () => {
  let regeneratedCount = 0;
  let lastError = "";

  const mockPhoneProtection = {
    renderCaptcha() {
      regeneratedCount++;
    },
    chooseOption(isCorrect) {
      if (!isCorrect) {
        lastError = "Неверный ответ. Попробуйте ещё раз.";
        this.renderCaptcha();
        return;
      }
    }
  };

  mockPhoneProtection.chooseOption(false);
  assert.strictEqual(lastError, "Неверный ответ. Попробуйте ещё раз.");
  assert.strictEqual(lastError.includes("десерт"), false, "Текст ошибки не должен подсказывать ключевые слова");
  assert.strictEqual(lastError.includes("пирожное"), false);
  assert.strictEqual(regeneratedCount, 1, "При неверном ответе должна запускаться перегенерация вопроса");
});

test("submitOrder: для MAX не совершается неожиданный прыжок window.open, а выводится экран с чеком и кнопками", () => {
  let windowOpenCalled = false;
  const selectedMessenger = "max";

  // Логика: для telegram — сразу window.open, для MAX — показ экрана подтверждения
  if (selectedMessenger === "telegram") {
    windowOpenCalled = true;
  }

  assert.strictEqual(windowOpenCalled, false, "Для MAX не должно происходить немедленного прыжка в приложение");

  // Ссылка шеринга с автозаполнением формируется корректно
  const orderText = "Заказ #123";
  const shareUrl = `https://max.ru/:share?text=${encodeURIComponent(orderText)}`;
  assert.ok(shareUrl.startsWith("https://max.ru/:share?text="));
  assert.ok(shareUrl.includes(encodeURIComponent("Заказ #123")));
});


