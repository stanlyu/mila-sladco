const test = require("node:test");
const assert = require("node:assert");
const { SyncService, DEFAULT_SYNC_CONFIG } = require("../js/sync-service.js");

// Мок localStorage для тестов в Node.js
if (typeof global.localStorage === "undefined") {
  const store = {};
  global.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    }
  };
}

test("SyncService: инициализация и конфигурация по умолчанию (Zero-Token Cloud Ready)", () => {
  global.localStorage.clear();
  const cfg = SyncService.init();
  assert.strictEqual(cfg.githubOwner, "stanlyu");
  assert.strictEqual(cfg.githubRepo, "mila-sladco");
  assert.strictEqual(cfg.githubBranch, "main");
  assert.ok(cfg.cloudCatalogUrl.includes("npoint.io"));
  assert.ok(cfg.cloudProfileUrl.includes("npoint.io"));
  // По умолчанию запись доступна через облачную базу данных без ввода токенов кондитером
  assert.strictEqual(SyncService.hasWriteAccess(), true);
});

test("SyncService: проверка прав на запись с токеном и без облака", () => {
  // Если отключить облако и встроенный токен — запись недоступна
  SyncService.saveConfig({ cloudCatalogUrl: "", disableToken: true, githubToken: "" });
  assert.strictEqual(SyncService.hasWriteAccess(), false);

  // С токеном GitHub — запись доступна
  SyncService.saveConfig({ disableToken: false, githubToken: "ghp_mocktest1234567890abcdef" });
  assert.strictEqual(SyncService.hasWriteAccess(), true);
  assert.strictEqual(SyncService.getConfig().githubToken, "ghp_mocktest1234567890abcdef");

  // Восстанавливаем облачную конфигурацию
  SyncService.saveConfig({
    cloudCatalogUrl: DEFAULT_SYNC_CONFIG.cloudCatalogUrl,
    disableToken: false,
    githubToken: ""
  });
  assert.strictEqual(SyncService.hasWriteAccess(), true);
});

test("SyncService: UTF-8 safe кодирование и декодирование в Base64", () => {
  const sample = "Манго-Маракуйя: 450 руб 🍰 • Авторский десерт кондитера Люды";
  const encoded = SyncService.utf8ToBase64(sample);
  assert.ok(typeof encoded === "string" && encoded.length > 0);

  const decoded = SyncService.base64ToUtf8(encoded);
  assert.strictEqual(decoded, sample);
});

test("SyncService: pushToRemote без токена и без облака возвращает понятную ошибку без сбоя", async () => {
  SyncService.saveConfig({ cloudCatalogUrl: "", disableToken: true, githubToken: "" });
  const result = await SyncService.pushToRemote([{ id: "test", title: "Торт" }]);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.reason, "no_token");

  // Восстанавливаем облачную конфигурацию
  SyncService.saveConfig({
    cloudCatalogUrl: DEFAULT_SYNC_CONFIG.cloudCatalogUrl,
    cloudProfileUrl: DEFAULT_SYNC_CONFIG.cloudProfileUrl,
    disableToken: false
  });
});
