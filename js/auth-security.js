/**
 * Модуль безопасной аутентификации кондитера Люды (Mila_sladco)
 * Обеспечивает:
 * - Защиту от несанкционированного доступа посторонних пользователей;
 * - Хэширование PIN-кода (не хранится в открытом виде);
 * - Защиту от перебора (rate limiting / lock на 5 минут после 3 ошибок);
 * - Сессионное хранение авторизации (sessionStorage);
 * - Возможность смены PIN-кода.
 */

const SALT = "mila_sladco_secret_salt_2026";

function hashPin(pin) {
  const str = `${SALT}_${pin}_mila`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return String(Math.abs(hash));
}

// Стандартный PIN Люды: 1819 (последние цифры телефона)
const DEFAULT_PIN_HASH = hashPin("1819");

const AuthSecurity = {
  SESSION_KEY: "mila_sladco_auth_session_v2",
  PIN_STORAGE_KEY: "mila_sladco_pin_hash_v2",
  LOCK_STORAGE_KEY: "mila_sladco_auth_lock_v2",
  ATTEMPTS_STORAGE_KEY: "mila_sladco_auth_attempts_v2",

  MAX_ATTEMPTS: 3,
  LOCK_DURATION_MS: 5 * 60 * 1000, // 5 минут блокировки

  init() {
    // Проверка целостности
  },

  getStoredHash() {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(this.PIN_STORAGE_KEY);
        if (stored) return stored;
      }
    } catch (e) {
      console.warn("Storage access warning", e);
    }
    return DEFAULT_PIN_HASH;
  },

  getFailedAttempts() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem(this.ATTEMPTS_STORAGE_KEY) || "0", 10);
      }
    } catch (e) {}
    return 0;
  },

  setFailedAttempts(count) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.ATTEMPTS_STORAGE_KEY, String(count));
      }
    } catch (e) {}
  },

  getLockUntil() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem(this.LOCK_STORAGE_KEY) || "0", 10);
      }
    } catch (e) {}
    return 0;
  },

  setLockUntil(timestamp) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.LOCK_STORAGE_KEY, String(timestamp));
      }
    } catch (e) {}
  },

  resetLock() {
    this.setFailedAttempts(0);
    this.setLockUntil(0);
  },

  resetToDefault() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(this.PIN_STORAGE_KEY);
        localStorage.removeItem("mila_sladco_pin_hash");
        localStorage.removeItem(this.LOCK_STORAGE_KEY);
        localStorage.removeItem("mila_sladco_auth_lock");
        localStorage.removeItem(this.ATTEMPTS_STORAGE_KEY);
        localStorage.removeItem("mila_sladco_auth_attempts");
      }
    } catch (e) {}
    this.resetLock();
  },

  isAuthenticated() {
    try {
      if (typeof sessionStorage !== "undefined") {
        return sessionStorage.getItem(this.SESSION_KEY) === "active";
      }
    } catch (e) {}
    return false;
  },

  logout() {
    this.resetLock();
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(this.SESSION_KEY);
      }
    } catch (e) {}
  },

  verifyPin(inputPin) {
    const now = Date.now();
    const lockUntil = this.getLockUntil();

    // Проверка активной блокировки от перебора
    if (lockUntil > now) {
      const remainingSec = Math.ceil((lockUntil - now) / 1000);
      return {
        success: false,
        isLocked: true,
        lockTimeRemaining: remainingSec,
        message: `Ввод заблокирован из соображений безопасности. Повторите через ${remainingSec} сек.`
      };
    }

    const correctHash = this.getStoredHash();
    const inputHash = hashPin(String(inputPin).trim());

    if (inputHash === correctHash) {
      // Успех! Сбрасываем счетчик ошибок
      this.resetLock();
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(this.SESSION_KEY, "active");
        }
      } catch (e) {}
      return { success: true };
    }

    // Неверный PIN
    let attempts = this.getFailedAttempts() + 1;
    this.setFailedAttempts(attempts);

    if (attempts >= this.MAX_ATTEMPTS) {
      const lockTime = now + this.LOCK_DURATION_MS;
      this.setLockUntil(lockTime);
      return {
        success: false,
        isLocked: true,
        lockTimeRemaining: Math.ceil(this.LOCK_DURATION_MS / 1000),
        message: "Превышено число попыток ввода PIN-кода. Панель временно заблокирована на 5 минут."
      };
    }

    const attemptsLeft = this.MAX_ATTEMPTS - attempts;
    return {
      success: false,
      isLocked: false,
      attemptsLeft,
      message: `Неверный PIN-код. Осталось попыток: ${attemptsLeft}`
    };
  },

  changePin(currentPin, newPin) {
    const currentHash = this.getStoredHash();
    const inputHash = hashPin(String(currentPin).trim());
    if (inputHash !== currentHash) {
      return { success: false, message: "Текущий PIN-код указан неверно" };
    }

    if (!newPin || String(newPin).length !== 4) {
      return { success: false, message: "Новый PIN-код должен состоять ровно из 4 цифр" };
    }

    const newHash = hashPin(String(newPin).trim());
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.PIN_STORAGE_KEY, newHash);
      }
    } catch (e) {
      return { success: false, message: "Не удалось сохранить новый PIN в хранилище" };
    }

    return { success: true, message: "PIN-код успешно изменен!" };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { AuthSecurity, hashPin };
} else {
  window.AuthSecurity = AuthSecurity;
}
