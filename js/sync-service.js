/**
 * SyncService — синхронизация витрины и профиля Mila_sladco с базой данных GitHub / Cloud.
 * Поддерживает:
 * 1. Чтение актуальной базы из репозитория GitHub (data/catalog.json, data/profile.json)
 *    или через прямой GitHub REST API с обходом CDN-кэша.
 * 2. Автоматическую фиксацию изменений (коммиты) в GitHub при редактировании кондитером.
 * 3. Локальный кэш (Offline-First) для мгновенной отрисовки без задержек.
 * 4. Оптимизацию и сжатие загружаемых с телефона фото (Canvas WebGL/2D).
 */

const DEFAULT_SYNC_CONFIG = {
  provider: "github", // "github" | "cloud" | "local"
  githubOwner: "stanlyu",
  githubRepo: "mila-sladco",
  githubBranch: "main",
  githubToken: "", // Personal Access Token (PAT) с правами на запись содержимого (Contents: Read/Write)
  cloudUrl: "", // Опциональный REST endpoint (например Firebase Realtime DB)
  lastSyncTime: null,
  autoSync: true
};

const SyncService = {
  CONFIG_KEY: "mila_sladco_sync_config_v2",
  config: null,
  isSyncing: false,

  init() {
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(this.CONFIG_KEY) : null;
      if (saved) {
        this.config = Object.assign({}, DEFAULT_SYNC_CONFIG, JSON.parse(saved));
      } else {
        this.config = Object.assign({}, DEFAULT_SYNC_CONFIG);
      }
    } catch (e) {
      console.warn("[SyncService] Ошибка чтения конфигурации синхронизации", e);
      this.config = Object.assign({}, DEFAULT_SYNC_CONFIG);
    }
    return this.config;
  },

  getConfig() {
    if (!this.config) this.init();
    return this.config;
  },

  saveConfig(newConfig) {
    this.config = Object.assign({}, this.getConfig(), newConfig);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
      }
    } catch (e) {
      console.warn("[SyncService] Ошибка сохранения настроек", e);
    }
    return this.config;
  },

  // Утилита кодирования UTF-8 строки в Base64 для GitHub API
  utf8ToBase64(str) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "utf8").toString("base64");
    }
    return btoa(unescape(encodeURIComponent(str)));
  },

  // Утилита декодирования Base64 из GitHub API в UTF-8 строку
  base64ToUtf8(b64) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(b64, "base64").toString("utf8");
    }
    return decodeURIComponent(escape(atob(String(b64 || "").replace(/\s/g, ""))));
  },

  // Проверка наличия настроенного токена для записи на GitHub
  hasWriteAccess() {
    const cfg = this.getConfig();
    return Boolean(cfg.githubToken && cfg.githubToken.trim().length > 10);
  },

  // Загрузка актуальных данных из базы (GitHub или статический data/*.json)
  async pullFromRemote() {
    if (this.isSyncing) return { success: false, reason: "in_progress" };
    this.isSyncing = true;
    const cfg = this.getConfig();

    try {
      let catalog = null;
      let profile = null;
      let source = "static";

      // 1. Попытка чтения через GitHub API (если есть токен или публичный доступ)
      const apiUrl = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/data/catalog.json?ref=${cfg.githubBranch}&t=${Date.now()}`;
      const headers = { Accept: "application/vnd.github.v3+json" };
      if (cfg.githubToken && cfg.githubToken.trim()) {
        headers["Authorization"] = `Bearer ${cfg.githubToken.trim()}`;
      }

      try {
        const res = await fetch(apiUrl, { headers, cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json && json.content) {
            const rawUtf8 = this.base64ToUtf8(json.content);
            catalog = JSON.parse(rawUtf8);
            source = "github_api";
          }
        }
      } catch (e) {
        // Ошибка GitHub API (например оффлайн или rate limit) — продолжаем к статическому файлу
        console.warn("[SyncService] GitHub API недоступен, пробуем статический файл:", e.message);
      }

      // 2. Если через API не удалось, пробуем статический файл data/catalog.json с обходом кэша
      if (!catalog) {
        try {
          const staticRes = await fetch(`data/catalog.json?v=${Date.now()}`, { cache: "no-store" });
          if (staticRes.ok) {
            catalog = await staticRes.json();
            source = "static_file";
          }
        } catch (e) {
          console.warn("[SyncService] Статический data/catalog.json недоступен:", e.message);
        }
      }

      // 3. Аналогично для профиля
      if (catalog) {
        try {
          const profApiUrl = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/data/profile.json?ref=${cfg.githubBranch}&t=${Date.now()}`;
          const profRes = await fetch(profApiUrl, { headers, cache: "no-store" });
          if (profRes.ok) {
            const json = await profRes.json();
            if (json && json.content) {
              profile = JSON.parse(this.base64ToUtf8(json.content));
            }
          }
        } catch (e) {
          console.warn("[SyncService] Ошибка чтения профиля из GitHub API:", e.message);
        }

        if (!profile) {
          try {
            const profStaticRes = await fetch(`data/profile.json?v=${Date.now()}`, { cache: "no-store" });
            if (profStaticRes.ok) {
              profile = await profStaticRes.json();
            }
          } catch (e) {
            console.warn("[SyncService] data/profile.json недоступен", e.message);
          }
        }

        // Обновляем CatalogManager и LocalStorage
        if (typeof CatalogManager !== "undefined") {
          CatalogManager.products = catalog;
          CatalogManager.save();
          if (profile) {
            CatalogManager.profile = Object.assign({}, CatalogManager.profile, profile);
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(CatalogManager.PROFILE_STORAGE_KEY, JSON.stringify(CatalogManager.profile));
            }
          }
          CatalogManager.notify();
          if (typeof window !== "undefined" && typeof window.renderProfile === "function") {
            window.renderProfile();
          }
        }

        this.config.lastSyncTime = new Date().toISOString();
        this.saveConfig(this.config);

        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("sync:completed", {
            detail: { source, count: catalog.length, time: this.config.lastSyncTime }
          }));
        }

        return { success: true, count: catalog.length, source };
      }

      return { success: false, reason: "not_found" };
    } catch (err) {
      console.error("[SyncService] Критическая ошибка синхронизации:", err);
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  },

  // Запись изменений в GitHub репозиторий (Коммит через GitHub REST API)
  async pushToRemote(catalogData, profileData) {
    const cfg = this.getConfig();
    if (!this.hasWriteAccess()) {
      return {
        success: false,
        reason: "no_token",
        message: "GitHub Token не настроен. Изменения сохранены локально в вашем браузере."
      };
    }

    if (this.isSyncing) return { success: false, reason: "in_progress" };
    this.isSyncing = true;

    try {
      const token = cfg.githubToken.trim();
      const baseApi = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents`;
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      };

      // 1. Получаем текущий SHA для data/catalog.json
      let catalogSha = null;
      try {
        const getShaRes = await fetch(`${baseApi}/data/catalog.json?ref=${cfg.githubBranch}&t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
        });
        if (getShaRes.ok) {
          const fileInfo = await getShaRes.json();
          catalogSha = fileInfo.sha;
        }
      } catch (e) {
        console.warn("[SyncService] Ошибка получения SHA каталога", e);
      }

      // 2. Отправляем обновленный data/catalog.json
      const catalogJsonStr = JSON.stringify(catalogData || [], null, 2);
      const catalogBase64 = this.utf8ToBase64(catalogJsonStr);
      const catalogBody = {
        message: `chore(catalog): обновление витрины кондитером [${new Date().toLocaleTimeString("ru-RU")}]`,
        content: catalogBase64,
        branch: cfg.githubBranch
      };
      if (catalogSha) catalogBody.sha = catalogSha;

      const putRes = await fetch(`${baseApi}/data/catalog.json`, {
        method: "PUT",
        headers,
        body: JSON.stringify(catalogBody)
      });

      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        throw new Error(errJson.message || `GitHub API вернул статус ${putRes.status}`);
      }

      // 3. Если передан profileData — сохраняем также data/profile.json
      if (profileData) {
        let profileSha = null;
        try {
          const getProfShaRes = await fetch(`${baseApi}/data/profile.json?ref=${cfg.githubBranch}&t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
          });
          if (getProfShaRes.ok) {
            const fileInfo = await getProfShaRes.json();
            profileSha = fileInfo.sha;
          }
        } catch (e) {
          console.warn("[SyncService] Ошибка получения SHA профиля", e);
        }

        const profileJsonStr = JSON.stringify(profileData, null, 2);
        const profileBase64 = this.utf8ToBase64(profileJsonStr);
        const profileBody = {
          message: `chore(profile): обновление контактов и профиля шефа [${new Date().toLocaleTimeString("ru-RU")}]`,
          content: profileBase64,
          branch: cfg.githubBranch
        };
        if (profileSha) profileBody.sha = profileSha;

        await fetch(`${baseApi}/data/profile.json`, {
          method: "PUT",
          headers,
          body: JSON.stringify(profileBody)
        });
      }

      this.config.lastSyncTime = new Date().toISOString();
      this.saveConfig(this.config);

      if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent("sync:pushed", {
          detail: { time: this.config.lastSyncTime }
        }));
      }

      return {
        success: true,
        message: "База данных на GitHub успешно обновлена! Все покупатели увидят свежие данные."
      };
    } catch (err) {
      console.error("[SyncService] Ошибка при записи на GitHub:", err);
      return {
        success: false,
        error: err.message,
        message: `Ошибка отправки на GitHub: ${err.message}`
      };
    } finally {
      this.isSyncing = false;
    }
  },

  // Оптимизация изображения из файла перед сохранением (макс 1000px, JPEG 82%)
  compressImage(file, maxDimension = 1000, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        return reject(new Error("Файл не является изображением"));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error("Не удалось прочитать изображение"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsDataURL(file);
    });
  }
};

// Экспорт для Node.js тестов и браузера
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SyncService, DEFAULT_SYNC_CONFIG };
} else {
  window.SyncService = SyncService;
  window.DEFAULT_SYNC_CONFIG = DEFAULT_SYNC_CONFIG;
}
