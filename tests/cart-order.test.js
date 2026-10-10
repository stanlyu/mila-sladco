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
