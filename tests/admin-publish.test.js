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
      style: {}
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

// Мокаем CatalogManager
global.CatalogManager = {
  getProducts() { return [{ id: "1", title: "Торт" }]; },
  getProfile() { return { owner: "Люда" }; }
};

// Мокаем SyncService
global.SyncService = {
  async pushToRemote() {
    return { success: true };
  }
};

const { AdminPanel } = require("../js/admin.js");

test("AdminPanel: markUnpublishedChanges фиксирует изменения и обновляет плашку", () => {
  AdminPanel.hasUnpublishedChanges = false;
  AdminPanel.markUnpublishedChanges();

  assert.strictEqual(AdminPanel.hasUnpublishedChanges, true);
  const textEl = getMockElement("sync-status-text");
  assert.strictEqual(textEl.textContent, "⚠️ Есть несохранённые изменения");
  const barEl = getMockElement("admin-sync-bar");
  assert.strictEqual(barEl.classList.contains("has-pending"), true);
});

test("AdminPanel: при попытке выхода с несохраненными изменениями запрашивается подтверждение (Отмена оставляет окно открытым)", () => {
  AdminPanel.hasUnpublishedChanges = true;
  let confirmAsked = false;
  global.confirm = (msg) => {
    confirmAsked = true;
    assert.strictEqual(msg, "У вас есть несохраненные изменения. Хотите выйти без сохранения?");
    return false; // Нажимаем «Отмена»
  };

  const modal = getMockElement("admin-modal");
  modal.classList.add("open");

  AdminPanel.close();
  assert.strictEqual(confirmAsked, true);
  assert.strictEqual(modal.classList.contains("open"), true); // Окно НЕ закрылось
});

test("AdminPanel: при подтверждении «Да» окно закрывается без сохранения", () => {
  AdminPanel.hasUnpublishedChanges = true;
  let confirmAsked = false;
  global.confirm = () => {
    confirmAsked = true;
    return true; // Нажимаем «Да»
  };

  const modal = getMockElement("admin-modal");
  modal.classList.add("open");

  AdminPanel.close();
  assert.strictEqual(confirmAsked, true);
  assert.strictEqual(modal.classList.contains("open"), false); // Окно закрылось
});

test("AdminPanel: ручная публикация сбрасывает флаг несохраненных изменений", async () => {
  AdminPanel.hasUnpublishedChanges = true;
  await AdminPanel.manualPublish();

  assert.strictEqual(AdminPanel.hasUnpublishedChanges, false);
  const textEl = getMockElement("sync-status-text");
  assert.ok(textEl.textContent.includes("🟢 Все изменения опубликованы на сайте"));
  const barEl = getMockElement("admin-sync-bar");
  assert.strictEqual(barEl.classList.contains("has-pending"), false);
});

test("AdminPanel: если все сохранено/опубликовано, выход происходит без алертов", () => {
  AdminPanel.hasUnpublishedChanges = false;
  let confirmCalled = false;
  global.confirm = () => {
    confirmCalled = true;
    return false;
  };

  const modal = getMockElement("admin-modal");
  modal.classList.add("open");

  AdminPanel.close();
  assert.strictEqual(confirmCalled, false); // Алерт НЕ вызывался
  assert.strictEqual(modal.classList.contains("open"), false); // Окно закрылось штатно
});
