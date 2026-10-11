const test = require("node:test");
const assert = require("node:assert");

// Мокаем DOM и глобальные объекты
const mockElements = {};
function getMockElement(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      className: "",
      classList: {
        add(cls) { if (!this.classes.includes(cls)) this.classes.push(cls); },
        remove(cls) { this.classes = this.classes.filter(c => c !== cls); },
        contains(cls) { return this.classes.includes(cls); },
        classes: []
      },
      textContent: "",
      disabled: false,
      style: {},
      focus() { this.isFocused = true; }
    };
  }
  return mockElements[id];
}

global.document = {
  getElementById: (id) => getMockElement(id),
  addEventListener: () => {},
  querySelector: () => null
};
global.window = {};
global.showToast = () => {};

// Мокаем AuthSecurity
global.AuthSecurity = {
  isAuth: true,
  isAuthenticated() { return this.isAuth; },
  logout() { this.isAuth = false; }
};

let mockChanged = false;
global.CatalogManager = {
  getProducts() { return [{ id: "1", title: "Торт" }]; },
  getProfile() { return { owner: "Люда" }; },
  hasActualChanges() { return mockChanged; },
  commitPublishedSnapshot() { mockChanged = false; },
  discardUnpublishedChanges() { mockChanged = false; }
};

// Мокаем SyncService
global.SyncService = {
  async pushToRemote() {
    return { success: true };
  }
};

const { AdminPanel } = require("../js/admin.js");

test("AdminPanel: markUnpublishedChanges фиксирует изменения и обновляет плашку", () => {
  mockChanged = true;
  AdminPanel.hasUnpublishedChanges = false;
  AdminPanel.markUnpublishedChanges();

  assert.strictEqual(AdminPanel.hasUnpublishedChanges, true);
  const textEl = getMockElement("sync-status-text");
  assert.strictEqual(textEl.textContent, "⚠️ Есть несохранённые изменения");
  const barEl = getMockElement("admin-sync-bar");
  assert.strictEqual(barEl.classList.contains("has-pending"), true);
});

test("AdminPanel: при выходе с несохраненными изменениями открывается кастомное модальное окно (без нативных confirm)", () => {
  mockChanged = true;
  AdminPanel.hasUnpublishedChanges = true;

  const adminModal = getMockElement("admin-modal");
  adminModal.classList.add("open");
  const exitModal = getMockElement("admin-unsaved-exit-modal");
  exitModal.classList.remove("open");

  AdminPanel.close();

  // Окно предупреждения открылось, а админка осталась открытой
  assert.strictEqual(exitModal.classList.contains("open"), true);
  assert.strictEqual(adminModal.classList.contains("open"), true);

  // Пользователь нажал «Остаться в кабинете»
  AdminPanel.closeUnsavedExitModal();
  assert.strictEqual(exitModal.classList.contains("open"), false);
  assert.strictEqual(adminModal.classList.contains("open"), true);
});

test("AdminPanel: подтверждение выхода без сохранения сбрасывает изменения и закрывает админку", () => {
  mockChanged = true;
  AdminPanel.hasUnpublishedChanges = true;

  const adminModal = getMockElement("admin-modal");
  adminModal.classList.add("open");
  const exitModal = getMockElement("admin-unsaved-exit-modal");
  exitModal.classList.add("open");

  AdminPanel.confirmDiscardAndExit();

  assert.strictEqual(mockChanged, false);
  assert.strictEqual(AdminPanel.hasUnpublishedChanges, false);
  assert.strictEqual(exitModal.classList.contains("open"), false);
  assert.strictEqual(adminModal.classList.contains("open"), false);
});

test("AdminPanel: ручная публикация сбрасывает флаг несохраненных изменений", async () => {
  mockChanged = true;
  AdminPanel.hasUnpublishedChanges = true;
  await AdminPanel.manualPublish();

  assert.strictEqual(AdminPanel.hasUnpublishedChanges, false);
  const textEl = getMockElement("sync-status-text");
  assert.ok(textEl.textContent.includes("🟢 Все изменения опубликованы на сайте"));
  const barEl = getMockElement("admin-sync-bar");
  assert.strictEqual(barEl.classList.contains("has-pending"), false);
});

test("AdminPanel: если все сохранено/опубликовано, выход происходит без открытия окна подтверждения", () => {
  mockChanged = false;
  AdminPanel.hasUnpublishedChanges = false;

  const adminModal = getMockElement("admin-modal");
  adminModal.classList.add("open");
  const exitModal = getMockElement("admin-unsaved-exit-modal");
  exitModal.classList.remove("open");

  AdminPanel.close();
  assert.strictEqual(exitModal.classList.contains("open"), false);
  assert.strictEqual(adminModal.classList.contains("open"), false); // Окно закрылось штатно
});

test("AdminPanel: saveContacts валидирует телефон и адрес, подсвечивает ошибки и предотвращает некорректное сохранение", () => {
  let profileSaved = null;
  global.CatalogManager.updateProfile = (patch) => {
    profileSaved = patch;
  };
  global.validatePhoneNumber = (p) => p.replace(/\D/g, "").length === 11;

  // Ошибка 1: короткий адрес самовывоза
  getMockElement("setting-pickup-address").value = "Мск";
  getMockElement("setting-phone").value = "+7 (915) 318-18-19";
  getMockElement("setting-show-phone").checked = true;
  getMockElement("setting-show-tg-direct").checked = false;
  getMockElement("setting-show-max-direct").checked = false;

  const result1 = AdminPanel.saveContacts();
  assert.strictEqual(result1, false);
  assert.strictEqual(getMockElement("setting-pickup-address").classList.contains("input-error"), true);
  assert.strictEqual(getMockElement("error-setting-pickup-address").textContent.includes("минимум 5 символов"), true);

  // Ошибка 2: некорректный телефон при включённых звонках
  getMockElement("setting-pickup-address").value = "Москва, м. Раменки";
  getMockElement("setting-phone").value = "12345";
  const result2 = AdminPanel.saveContacts();
  assert.strictEqual(result2, false);
  assert.strictEqual(getMockElement("setting-phone").classList.contains("input-error"), true);

  // Успех: корректные данные
  getMockElement("setting-phone").value = "+7 (915) 318-18-19";
  getMockElement("setting-show-tg-direct").checked = true;
  getMockElement("setting-tg-user").value = "mila_sladco";
  const result3 = AdminPanel.saveContacts();
  assert.strictEqual(result3, true);
  assert.strictEqual(getMockElement("setting-phone").classList.contains("input-error"), false);
  assert.strictEqual(getMockElement("setting-pickup-address").classList.contains("input-error"), false);
  assert.strictEqual(profileSaved.telegramUsername, "mila_sladco");
});
