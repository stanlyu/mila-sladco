const test = require("node:test");
const assert = require("node:assert");

class StorageMock {
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

global.sessionStorage = new StorageMock();
global.localStorage = new StorageMock();

// Подключаем модуль AuthSecurity (пока не реализован - Red Phase)
const { AuthSecurity } = require("../js/auth-security.js");

test("AuthSecurity: по умолчанию не авторизован", () => {
  AuthSecurity.init();
  AuthSecurity.logout();
  assert.strictEqual(AuthSecurity.isAuthenticated(), false);
});

test("AuthSecurity: успешная авторизация по стандартному PIN-коду (1414)", () => {
  AuthSecurity.init();
  AuthSecurity.logout();

  const result = AuthSecurity.verifyPin("1414");
  assert.strictEqual(result.success, true);
  assert.strictEqual(AuthSecurity.isAuthenticated(), true);
});

test("AuthSecurity: отклонение неверного PIN-кода", () => {
  AuthSecurity.init();
  AuthSecurity.logout();

  const result = AuthSecurity.verifyPin("0000");
  assert.strictEqual(result.success, false);
  assert.strictEqual(AuthSecurity.isAuthenticated(), false);
  assert.strictEqual(result.attemptsLeft, 2);
});

test("AuthSecurity: блокировка после 3 неверных попыток (Anti-Bruteforce)", () => {
  AuthSecurity.init();
  AuthSecurity.logout();

  AuthSecurity.verifyPin("1111"); // 1
  AuthSecurity.verifyPin("2222"); // 2
  const thirdTry = AuthSecurity.verifyPin("3333"); // 3

  assert.strictEqual(thirdTry.success, false);
  assert.strictEqual(thirdTry.isLocked, true);
  assert.ok(thirdTry.lockTimeRemaining > 0);

  // Даже правильный PIN заблокирован во время локдауна
  const lockedAttempt = AuthSecurity.verifyPin("1414");
  assert.strictEqual(lockedAttempt.success, false);
  assert.strictEqual(lockedAttempt.isLocked, true);
});

test("AuthSecurity: кондитер может сменить PIN-код на свой", () => {
  AuthSecurity.init();
  AuthSecurity.resetLock(); // сброс лока для теста
  AuthSecurity.verifyPin("1414");

  const changeResult = AuthSecurity.changePin("1414", "9876");
  assert.strictEqual(changeResult.success, true);

  AuthSecurity.logout();

  // Старый PIN больше не подходит
  assert.strictEqual(AuthSecurity.verifyPin("1414").success, false);

  // Новый PIN успешно авторизует
  assert.strictEqual(AuthSecurity.verifyPin("9876").success, true);
});
