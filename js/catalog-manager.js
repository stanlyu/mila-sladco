/**
 * CatalogManager — управление базой десертов кондитерской Mila_sladco
 * Поддерживает сохранение в LocalStorage, динамическое редактирование цен,
 * описаний, фото и статусов наличия для кондитера Люды.
 */

const DEFAULT_PRODUCTS = [
  {
    id: "mango-passion",
    title: "Манго-Маракуйя",
    category: "pastry",
    categoryName: "Корпусные пирожные",
    badge: "Хит продаж",
    badgeColor: "gold",
    price: 450,
    weight: "110 г",
    image: "assets/images/mango-passion.jpg",
    isAvailable: true,
    shortDesc: "Тропический мусс из спелого манго с освежающим центром из маракуйи и хрустящим сабле.",
    fullDesc: "Нежнейший мусс на основе пюре Alphonso Mango с легкой кислинкой маракуйи, спрятанный под зеркальной глазурью. Внутри — фруктовое конфи и хрустящий слой с бельгийской вафельной крошкой.",
    layers: [
      "Зеркальная глазурь с натуральным соком манго",
      "Сливочно-манговый мусс на белом шоколаде",
      "Конфи маракуйя с косточками",
      "Миндальное сабле с вафельной крошкой"
    ],
    nutrition: {
      calories: "285 ккал",
      proteins: "4.2 г",
      fats: "14.8 г",
      carbs: "33.5 г"
    },
    ingredients: "Пюре манго, пюре маракуйи, белый шоколад Callebaut, сливки 33%, желатин листовой, миндальная мука, сливочное масло 82.5%, сахарная пудра.",
    shelfLife: "72 часа при температуре от +2°C до +6°C"
  },
  {
    id: "chocolate-truffle",
    title: "Шоколадный Трюфель",
    category: "pastry",
    categoryName: "Корпусные пирожные",
    badge: "Бестселлер",
    badgeColor: "chocolate",
    price: 450,
    weight: "115 г",
    image: "assets/images/chocolate-truffle.jpg",
    isAvailable: true,
    shortDesc: "Глубокий темный шоколад в бархатном велюре с начинкой из соленой карамели и золотой поталью.",
    fullDesc: "Истинное удовольствие для ценителей премиального шоколада. Текстурированный куб в шоколадном велюре с ганашем на темном шоколаде 70% и мягкой карамельной сердцевиной fleur de sel.",
    layers: [
      "Шоколадный велюр из темного какао-масла",
      "Мусс на темном бельгийском шоколаде 70%",
      "Тягучая соленая карамель с морской солью",
      "Влажный брауни-бисквит с дробленым фундуком"
    ],
    nutrition: {
      calories: "340 ккал",
      proteins: "5.6 г",
      fats: "21.2 г",
      carbs: "31.8 г"
    },
    ingredients: "Темный шоколад Callebaut 70%, сливки 33%, масло какао, морская соль Fleur de Sel, фундук обжаренный, тростниковый сахар, сусальное золото.",
    shelfLife: "72 часа при температуре от +2°C до +6°C"
  },
  {
    id: "pistachio-raspberry",
    title: "Фисташка-Малина",
    category: "pastry",
    categoryName: "Корпусные пирожные",
    badge: "Любимое гостями",
    badgeColor: "green",
    price: 490,
    weight: "120 г",
    image: "assets/images/pistachio-raspberry.jpg",
    isAvailable: true,
    shortDesc: "Муссовое сердце с изумрудной сицилийской фисташкой и ярким малиновым кули.",
    fullDesc: "Идеальный баланс благородной фисташки и свежей лесной малины. Глянцевое покрытие цвета весенней листвы с россыпью свежих ягод и дробленых фисташек.",
    layers: [
      "Изумрудная зеркальная глазурь",
      "Воздушный мусс из 100% сицилийской фисташковой пасты",
      "Ягодное кули из спелой садовой малины",
      "Фисташковый бисквит Джоконда"
    ],
    nutrition: {
      calories: "310 ккал",
      proteins: "6.1 г",
      fats: "18.4 г",
      carbs: "29.2 г"
    },
    ingredients: "Натуральная паста из сицилийской фисташки, малина свежемороженая, белый шоколад, сливки фермерские 33%, миндальная мука, яйцо куриное, свежие ягоды.",
    shelfLife: "72 часа при температуре от +2°C до +6°C"
  },
  {
    id: "coconut-lime",
    title: "Кокос-Лайм",
    category: "pastry",
    categoryName: "Корпусные пирожные",
    badge: "Новинка",
    badgeColor: "teal",
    price: 470,
    weight: "115 г",
    image: "assets/images/coconut-lime.jpg",
    isAvailable: true,
    shortDesc: "Нежный кокосовый крем в тонком корпусе из белого шоколада с лаймовым гелем.",
    fullDesc: "Оригинальное пирожное с текстурой натурального кокосового ореха. Внутри скрывается шелковистый крем на кокосовом молоке и бодрящая лаймовая начинка.",
    layers: [
      "Белый шоколадный корпус с кокосовой стружкой",
      "Кремовый кокосовый мусс на кокосовых сливках",
      "Освежающий лаймовый курд с цедрой",
      "Хрустящий кокосовый крамбл"
    ],
    nutrition: {
      calories: "298 ккал",
      proteins: "3.8 г",
      fats: "19.5 г",
      carbs: "26.4 г"
    },
    ingredients: "Кокосовые сливки Aroy-D, сок и цедра органического лайма, белый шоколад 32%, кокосовая стружка мелкого помола, тростниковый сахар.",
    shelfLife: "72 часа при температуре от +2°C до +6°C"
  },
  {
    id: "blueberry-lavender",
    title: "Черника-Лаванда",
    category: "pastry",
    categoryName: "Корпусные пирожные",
    badge: "Изысканный вкус",
    badgeColor: "purple",
    price: 470,
    weight: "115 г",
    image: "assets/images/blueberry-lavender.jpg",
    isAvailable: true,
    shortDesc: "Таинственный мусс с лесной черникой и тонким ароматом прованской лаванды.",
    fullDesc: "Глубокий фиолетовый глянец, украшенный золотой поталью и веточкой лаванды. Мягкий ягодно-цветочный аромат, переносящий в цветущие поля Прованса.",
    layers: [
      "Фиолетовая зеркальная глазурь",
      "Мусс на пюре лесной черники",
      "Нежный кремё с цветками прованской лаванды",
      "Черничный бисквит на миндальной муке"
    ],
    nutrition: {
      calories: "275 ккал",
      proteins: "4.0 г",
      fats: "15.0 г",
      carbs: "31.0 г"
    },
    ingredients: "Лесная черника, натуральные сушеные цветы лаванды, белый шоколад, сливки 33%, миндальная мука, свежие ягоды голубики.",
    shelfLife: "72 часа при температуре от +2°C до +6°C"
  },
  {
    id: "box-6",
    title: "Подарочный набор «Коллекция вкусов» (6 шт)",
    category: "boxes",
    categoryName: "Подарочные наборы",
    badge: "Выгодно / Подарок",
    badgeColor: "gold",
    price: 2500,
    oldPrice: 2700,
    weight: "690 г",
    image: "assets/images/box-6.jpg",
    isAvailable: true,
    shortDesc: "Шесть авторских корпусных пирожных в премиальной белой коробке с шелковой лентой.",
    fullDesc: "Идеальный подарок на день рождения, годовщину или знак внимания. В наборе собраны все ключевые вкусы кондитерской: Манго, Шоколадный Трюфель, Фисташка, Кокос, Черника и Ваниль. Поставляется с открыткой для пожеланий.",
    layers: [
      "Белоснежная подарочная коробка с ложементами",
      "Шелковая атласная лента цвета шампань",
      "6 уникальных вкусов корпусных пирожных",
      "Дизайнерская мини-открытка в подарок"
    ],
    nutrition: {
      calories: "~300 ккал / 100 г",
      proteins: "4.8 г",
      fats: "17.5 г",
      carbs: "30.5 г"
    },
    ingredients: "Только натуральные ингредиенты премиум-класса (Франция, Бельгия, Италия). Полный состав каждого пирожного указан во вкладыше коробки.",
    shelfLife: "72 часа при температуре от +2°C до +6°C"
  },
  {
    id: "bento-berry",
    title: "Бенто-торт «Ягодный праздник»",
    category: "bento",
    categoryName: "Бенто-торты",
    badge: "На 1-2 персоны",
    badgeColor: "pink",
    price: 1600,
    weight: "450 г",
    image: "assets/images/bento-berry.jpg",
    isAvailable: true,
    shortDesc: "Мини-торт в эко-боксе со свежей клубникой, голубикой и индивидуальной надписью.",
    fullDesc: "Уютный корейский бенто-торт диаметром 10 см. В комплекте идет деревянная ложечка и праздничная свечка. Можно сделать любую вашу надпись кремом бесплатно!",
    layers: [
      "Нежнейший сливочный крем чиз на маскарпоне",
      "Свежая клубника и спелая голубика",
      "Воздушный ванильный бисквит",
      "Ягодная пропитка с соком мадагаскарской ванили"
    ],
    nutrition: {
      calories: "280 ккал / 100 г",
      proteins: "5.1 г",
      fats: "16.2 г",
      carbs: "28.4 г"
    },
    ingredients: "Сыр творожный Cremette, сливки 33%, яйца куриные высшей категории, сахар, мука пшеничная в/с, клубника свежая, голубика свежая, ваниль натуральная.",
    shelfLife: "72 часа при температуре от +2°C до +6°C"
  }
];

const CATEGORIES = [
  { id: "all", name: "Все десерты" },
  { id: "pastry", name: "Корпусные пирожные" },
  { id: "boxes", name: "Наборы в коробках" },
  { id: "bento", name: "Бенто-торты" }
];

const SHOP_INFO = {
  name: "Mila_sladco",
  title: "Авторские десерты & корпусные пирожные",
  owner: "Кондитер Люда",
  city: "Москва",
  metro: "м. Раменки / Доставка курьером",
  status: "Принимаем заказы на сегодня и предзаказы",
  phone: "+7 (915) 318-18-19",
  phoneClean: "+79153181819",
  telegramUsername: "mila_sladco",
  telegramChannel: "mila_sladco_cakes",
  telegramChannelUrl: "https://t.me/mila_sladco_cakes",
  telegramDirectUrl: "https://t.me/mila_sladco",
  maxUsername: "mila_sladco",
  maxDirectUrl: "https://max.ru/mila_sladco",
  deliveryNote: "Доставка Яндекс.Курьером по Москве и МО или удобный самовывоз."
};

const DEFAULT_PROFILE = {
  name: "Mila_sladco",
  tagline: "Авторские торты & корпусные пирожные • Москва",
  owner: "Кондитер Люда",
  avatar: "assets/images/chef-mila.jpg",
  statusText: "Принимаем заказы на сегодня и предзаказы",
  phone: "+7 (915) 318-18-19",
  phoneClean: "+79153181819",
  showPhone: false,
  telegramUsername: "mila_sladco",
  telegramChannelUrl: "https://t.me/mila_sladco_cakes",
  maxUsername: "mila_sladco",
  hasSeenTour: false
};

const CatalogManager = {
  STORAGE_KEY: "mila_sladco_custom_catalog_v1",
  PROFILE_STORAGE_KEY: "mila_sladco_profile_v1",
  products: [],
  profile: null,

  init() {
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(this.STORAGE_KEY) : null;
      if (saved) {
        this.products = JSON.parse(saved);
      } else {
        // Клонируем дефолтный список
        this.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      }
    } catch (e) {
      console.warn("Ошибка загрузки каталога, используются дефолтные", e);
      this.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    }

    try {
      const savedProf = typeof localStorage !== "undefined" ? localStorage.getItem(this.PROFILE_STORAGE_KEY) : null;
      if (savedProf) {
        this.profile = Object.assign({}, DEFAULT_PROFILE, JSON.parse(savedProf));
      } else {
        this.profile = Object.assign({}, DEFAULT_PROFILE);
      }
    } catch (e) {
      console.warn("Ошибка загрузки профиля, используются дефолтные", e);
      this.profile = Object.assign({}, DEFAULT_PROFILE);
    }
  },

  save() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.products));
      }
    } catch (e) {
      console.warn("Ошибка сохранения каталога", e);
    }
    this.notify();
  },

  getProducts() {
    if (!this.products || this.products.length === 0) {
      this.init();
    }
    return this.products;
  },

  getProductById(id) {
    return this.getProducts().find((p) => p.id === id);
  },

  updateProduct(id, patch) {
    const product = this.getProductById(id);
    if (!product) return null;

    Object.assign(product, patch);
    this.save();
    return product;
  },

  addProduct(data) {
    const id = data.id || `custom-${Date.now()}`;
    const newProduct = {
      id,
      title: data.title || "Новый авторский десерт",
      category: data.category || "pastry",
      categoryName: data.category === "bento" ? "Бенто-торты" : data.category === "boxes" ? "Подарочные наборы" : "Корпусные пирожные",
      badge: data.badge || "Новинка",
      badgeColor: data.badgeColor || "gold",
      price: Number(data.price) || 450,
      weight: data.weight || "110 г",
      image: data.image || "assets/images/mango-passion.jpg",
      isAvailable: data.isAvailable !== false,
      shortDesc: data.shortDesc || "Свежий авторский десерт ручной работы.",
      fullDesc: data.fullDesc || data.shortDesc || "Нежнейший десерт ручной работы от кондитера Люды.",
      layers: data.layers || ["Авторский мусс", "Натуральная начинка", "Основа сабле"],
      nutrition: data.nutrition || { calories: "290 ккал", proteins: "4.5 г", fats: "16 г", carbs: "32 г" },
      ingredients: data.ingredients || "Натуральные сливки, белый шоколад, ягодное пюре, сахар.",
      shelfLife: data.shelfLife || "72 часа при температуре от +2°C до +6°C"
    };

    this.products.unshift(newProduct);
    this.save();
    return newProduct;
  },

  deleteProduct(id) {
    this.products = this.products.filter((p) => p.id !== id);
    this.save();
  },

  toggleAvailability(id) {
    const product = this.getProductById(id);
    if (!product) return;
    product.isAvailable = product.isAvailable === false ? true : false;
    this.save();
    return product.isAvailable;
  },

  exportData() {
    return JSON.stringify(this.products, null, 2);
  },

  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.products = parsed;
        this.save();
        return true;
      }
    } catch (e) {
      console.error("Ошибка парсинга импортируемых данных", e);
    }
    return false;
  },

  resetToDefaults() {
    this.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    this.save();
  },

  getProfile() {
    if (!this.profile) {
      this.init();
    }
    return this.profile;
  },

  updateProfile(patch) {
    if (!this.profile) this.init();
    Object.assign(this.profile, patch);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      }
    } catch (e) {
      console.warn("Ошибка сохранения профиля", e);
    }
    this.notifyProfile();
    return this.profile;
  },

  resetProfile() {
    this.profile = Object.assign({}, DEFAULT_PROFILE);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(this.PROFILE_STORAGE_KEY);
      }
    } catch (e) {}
    this.notifyProfile();
  },

  notify() {
    if (typeof document !== "undefined" && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent("catalog:updated", {
        detail: { products: this.products }
      }));
    }
  },

  notifyProfile() {
    if (typeof document !== "undefined" && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent("profile:updated", {
        detail: { profile: this.profile }
      }));
    }
  }
};

// Экспорт для Node.js и браузера
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CatalogManager,
    DEFAULT_PRODUCTS,
    DEFAULT_PROFILE,
    CATEGORIES,
    SHOP_INFO
  };
} else {
  window.CatalogManager = CatalogManager;
  window.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;
  window.DEFAULT_PROFILE = DEFAULT_PROFILE;
  window.CATEGORIES = CATEGORIES;
  window.SHOP_INFO = SHOP_INFO;
}
