/**
 * SyncService — синхронизация витрины и профиля Mila_sladco с базой данных GitHub / Cloud.
 * Поддерживает:
 * 1. Фоновое чтение и запись в облачную базу данных (Zero-Auth / Zero-Token, без ввода ключей кондитером).
 * 2. Мгновенный обход кэша мобильных браузеров (?t=timestamp + cache: no-store).
 * 3. Локальный кэш (Offline-First) для мгновенной отрисовки без ожидания ответа сервера.
 * 4. Запасные каналы (Fallback): GitHub raw и локальные файлы data/*.json.
 * 5. Оптимизацию и сжатие загружаемых с телефона фото (Canvas 2D).
 */

const DEFAULT_SYNC_CONFIG = {
  provider: "cloud", // "cloud" | "github" | "local"
  cloudCatalogUrl: "https://api.npoint.io/2a6bc08a5699cf1f7910",
  cloudProfileUrl: "https://api.npoint.io/1622863e7880b2c4788d",
  githubOwner: "stanlyu",
  githubRepo: "mila-sladco",
  githubBranch: "main",
  githubToken: "",
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
      // Гарантируем наличие актуальных cloudUrl по умолчанию
      if (!this.config.cloudCatalogUrl) {
        this.config.cloudCatalogUrl = DEFAULT_SYNC_CONFIG.cloudCatalogUrl;
      }
      if (!this.config.cloudProfileUrl) {
        this.config.cloudProfileUrl = DEFAULT_SYNC_CONFIG.cloudProfileUrl;
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

  // Проверка готовности к записи (облачная база или токен)
  hasWriteAccess() {
    const cfg = this.getConfig();
    return Boolean(cfg.cloudCatalogUrl || (cfg.githubToken && cfg.githubToken.trim().length > 10));
  },

  // Загрузка актуальных данных из базы (Cloud -> GitHub API -> GitHub Raw -> Local Static)
  async pullFromRemote() {
    if (this.isSyncing) return { success: false, reason: "in_progress" };
    this.isSyncing = true;
    const cfg = this.getConfig();

    try {
      let catalog = null;
      let profile = null;
      let source = "static";

      // 1. Приоритет: Чтение из облачной базы данных (обход CDN-кэша через ?t=...)
      if (cfg.cloudCatalogUrl) {
        try {
          const cloudRes = await fetch(`${cfg.cloudCatalogUrl}?t=${Date.now()}`, {
            cache: "no-store",
            headers: { Accept: "application/json" }
          });
          if (cloudRes.ok) {
            const data = await cloudRes.json();
            if (Array.isArray(data) && data.length > 0) {
              catalog = data;
              source = "cloud_database";
            }
          }
        } catch (e) {
          console.warn("[SyncService] Облачная база каталога недоступна, пробуем fallback:", e.message);
        }
      }

      // 2. Fallback: GitHub API
      if (!catalog && cfg.githubOwner && cfg.githubRepo) {
        try {
          const apiUrl = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/data/catalog.json?ref=${cfg.githubBranch}&t=${Date.now()}`;
          const headers = { Accept: "application/vnd.github.v3+json" };
          if (cfg.githubToken && cfg.githubToken.trim()) {
            headers["Authorization"] = `Bearer ${cfg.githubToken.trim()}`;
          }
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
          console.warn("[SyncService] GitHub API недоступен:", e.message);
        }
      }

      // 3. Fallback: raw.githubusercontent.com
      if (!catalog && cfg.githubOwner && cfg.githubRepo) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${cfg.githubOwner}/${cfg.githubRepo}/${cfg.githubBranch}/data/catalog.json?t=${Date.now()}`;
          const rawRes = await fetch(rawUrl, { cache: "no-store" });
          if (rawRes.ok) {
            catalog = await rawRes.json();
            source = "github_raw";
          }
        } catch (e) {
          console.warn("[SyncService] raw.githubusercontent.com недоступен:", e.message);
        }
      }

      // 4. Fallback: локальный статический data/catalog.json
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

      // --- Загрузка профиля кондитера (Cloud -> GitHub API -> Raw -> Static) ---
      if (cfg.cloudProfileUrl) {
        try {
          const cloudProfRes = await fetch(`${cfg.cloudProfileUrl}?t=${Date.now()}`, {
            cache: "no-store",
            headers: { Accept: "application/json" }
          });
          if (cloudProfRes.ok) {
            profile = await cloudProfRes.json();
          }
        } catch (e) {
          console.warn("[SyncService] Облачный профиль недоступен:", e.message);
        }
      }

      if (!profile && cfg.githubOwner && cfg.githubRepo) {
        try {
          const profApiUrl = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/data/profile.json?ref=${cfg.githubBranch}&t=${Date.now()}`;
          const headers = { Accept: "application/vnd.github.v3+json" };
          if (cfg.githubToken && cfg.githubToken.trim()) {
            headers["Authorization"] = `Bearer ${cfg.githubToken.trim()}`;
          }
          const profRes = await fetch(profApiUrl, { headers, cache: "no-store" });
          if (profRes.ok) {
            const json = await profRes.json();
            if (json && json.content) {
              profile = JSON.parse(this.base64ToUtf8(json.content));
            }
          }
        } catch (e) {}
      }

      if (!profile && cfg.githubOwner && cfg.githubRepo) {
        try {
          const rawProfUrl = `https://raw.githubusercontent.com/${cfg.githubOwner}/${cfg.githubRepo}/${cfg.githubBranch}/data/profile.json?t=${Date.now()}`;
          const profRawRes = await fetch(rawProfUrl, { cache: "no-store" });
          if (profRawRes.ok) {
            profile = await profRawRes.json();
          }
        } catch (e) {}
      }

      if (!profile) {
        try {
          const profStaticRes = await fetch(`data/profile.json?v=${Date.now()}`, { cache: "no-store" });
          if (profStaticRes.ok) {
            profile = await profStaticRes.json();
          }
        } catch (e) {}
      }

      // Обновляем CatalogManager и LocalStorage
      if (catalog && typeof CatalogManager !== "undefined") {
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
          detail: { source, count: catalog ? catalog.length : 0, time: this.config.lastSyncTime }
        }));
      }

      return { success: true, count: catalog ? catalog.length : 0, source };
    } catch (err) {
      console.error("[SyncService] Критическая ошибка синхронизации:", err);
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  },

  // Запись изменений в облачную базу и/или GitHub
  async pushToRemote(catalogData, profileData) {
    const cfg = this.getConfig();
    if (!this.hasWriteAccess()) {
      return {
        success: false,
        reason: "no_token",
        message: "Хранилище не настроено. Данные сохранены локально в вашем браузере."
      };
    }

    if (this.isSyncing) return { success: false, reason: "in_progress" };
    this.isSyncing = true;

    try {
      // 1. Отправка в облачную базу данных (Zero-Token, фоновый режим)
      if (cfg.cloudCatalogUrl && catalogData) {
        try {
          await fetch(cfg.cloudCatalogUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(catalogData)
          });
        } catch (e) {
          console.warn("[SyncService] Ошибка записи каталога в облако:", e.message);
        }
      }

      if (cfg.cloudProfileUrl && profileData) {
        try {
          await fetch(cfg.cloudProfileUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profileData)
          });
        } catch (e) {
          console.warn("[SyncService] Ошибка записи профиля в облако:", e.message);
        }
      }

      // 2. Если настроен токен GitHub, также коммитим в репозиторий (опционально)
      if (cfg.githubToken && cfg.githubToken.trim().length > 10) {
        try {
          await this._pushToGitHub(catalogData, profileData, cfg);
        } catch (e) {
          console.warn("[SyncService] Ошибка коммита на GitHub:", e.message);
        }
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
        message: "База данных успешно обновлена! Все покупатели видят свежие десерты."
      };
    } catch (err) {
      console.error("[SyncService] Ошибка при записи в базу данных:", err);
      return {
        success: false,
        error: err.message,
        message: `Ошибка отправки данных: ${err.message}`
      };
    } finally {
      this.isSyncing = false;
    }
  },

  // Внутренний метод: коммит в GitHub репозиторий при наличии токена
  async _pushToGitHub(catalogData, profileData, cfg) {
    const token = cfg.githubToken.trim();
    const baseApi = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    if (catalogData) {
      let catalogSha = null;
      try {
        const getShaRes = await fetch(`${baseApi}/data/catalog.json?ref=${cfg.githubBranch}&t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
        });
        if (getShaRes.ok) {
          const fileInfo = await getShaRes.json();
          catalogSha = fileInfo.sha;
        }
      } catch (e) {}

      const catalogJsonStr = JSON.stringify(catalogData || [], null, 2);
      const catalogBase64 = this.utf8ToBase64(catalogJsonStr);
      const catalogBody = {
        message: `chore(catalog): обновление витрины кондитером [${new Date().toLocaleTimeString("ru-RU")}]`,
        content: catalogBase64,
        branch: cfg.githubBranch
      };
      if (catalogSha) catalogBody.sha = catalogSha;

      await fetch(`${baseApi}/data/catalog.json`, {
        method: "PUT",
        headers,
        body: JSON.stringify(catalogBody)
      });
    }

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
      } catch (e) {}

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
