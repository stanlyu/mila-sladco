const test = require("node:test");
const assert = require("node:assert");

// Имитируем окружение браузера (localStorage) для тестов в Node.js
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

// Подключаем модули, которые будем тестировать и реализовывать
const { CatalogManager, DEFAULT_PRODUCTS } = require("../js/catalog-manager.js");

test("CatalogManager: инициализация и получение дефолтных десертов", () => {
  CatalogManager.init();
  const products = CatalogManager.getProducts();
  assert.ok(Array.isArray(products));
  assert.ok(products.length >= 5);
  const mango = CatalogManager.getProductById("mango-passion");
  assert.strictEqual(mango.title, "Манго-Маракуйя");
  assert.strictEqual(mango.price, 450);
});

test("CatalogManager: Люда может изменить цену и описание десерта", () => {
  CatalogManager.init();
  CatalogManager.updateProduct("mango-passion", {
    price: 520,
    shortDesc: "Обновленное авторское описание от Люды"
  });

  const updated = CatalogManager.getProductById("mango-passion");
  assert.strictEqual(updated.price, 520);
  assert.strictEqual(updated.shortDesc, "Обновленное авторское описание от Люды");
});

test("CatalogManager: Люда может скрыть десерт, если он закончился («Нет в наличии»)", () => {
  CatalogManager.init();
  const before = CatalogManager.getProductById("chocolate-truffle");
  assert.strictEqual(before.isAvailable !== false, true);

  CatalogManager.toggleAvailability("chocolate-truffle");
  const after = CatalogManager.getProductById("chocolate-truffle");
  assert.strictEqual(after.isAvailable, false);

  // Повторный клик возвращает в наличие
  CatalogManager.toggleAvailability("chocolate-truffle");
  assert.strictEqual(CatalogManager.getProductById("chocolate-truffle").isAvailable, true);
});

test("CatalogManager: Люда может добавить свой новый авторский десерт", () => {
  CatalogManager.init();
  const initialCount = CatalogManager.getProducts().length;

  const newDessert = CatalogManager.addProduct({
    title: "Медовик с малиной",
    price: 480,
    category: "pastry",
    weight: "130 г",
    image: "assets/images/custom-dessert.jpg",
    shortDesc: "Нежные медовые коржи с заварным сметанным кремом и ягодами.",
    fullDesc: "Классический медовик в современной муссовой интерпретации.",
    layers: ["Карамельный глянец", "Сметанный мусс", "Медовые коржи"],
    nutrition: { calories: "320", proteins: "5", fats: "16", carbs: "38" },
    ingredients: "Мед гречишный, мука, яйца, сливочное масло, сметана 25%."
  });

  assert.ok(newDessert.id);
  const productsAfter = CatalogManager.getProducts();
  assert.strictEqual(productsAfter.length, initialCount + 1);
  assert.strictEqual(CatalogManager.getProductById(newDessert.id).title, "Медовик с малиной");
});

test("CatalogManager: Люда может удалить десерт из витрины", () => {
  CatalogManager.init();
  const added = CatalogManager.addProduct({
    title: "Временный десерт",
    price: 300,
    category: "pastry"
  });

  assert.ok(CatalogManager.getProductById(added.id));
  CatalogManager.deleteProduct(added.id);
  assert.strictEqual(CatalogManager.getProductById(added.id), undefined);
});

test("CatalogManager: экспорт и импорт базы десертов (резервная копия)", () => {
  CatalogManager.init();
  CatalogManager.updateProduct("mango-passion", { price: 999 });

  const backupJson = CatalogManager.exportData();
  assert.ok(typeof backupJson === "string");
  assert.ok(backupJson.includes("999"));

  // Сброс до фабричных
  CatalogManager.resetToDefaults();
  assert.strictEqual(CatalogManager.getProductById("mango-passion").price, 450);

  // Восстановление из бэкапа
  CatalogManager.importData(backupJson);
  assert.strictEqual(CatalogManager.getProductById("mango-passion").price, 999);
});
