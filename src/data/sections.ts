/**
 * Разделы сайта — то, как владелец видит свой сайт: кусками страницы,
 * а не списком строк.
 *
 * ЗАЧЕМ ЭТО ЕСТЬ. Сначала все тексты лежали одной страницей «Тексты сайта»:
 * пятнадцать групп полей, отсортированных по тому, где строка живёт в коде.
 * Владелец сказал прямо — чтобы поправить кусок первого экрана, надо зайти
 * в отдельную вкладку и найти нужную строку среди сотни чужих. Правится
 * не «текст сайта», правится ПЕРВЫЙ ЭКРАН: и заголовок, и снимок в рамке,
 * и подпись под ним — всё сразу и в одном месте.
 *
 * Поэтому здесь описан не каталог строк, а состав каждого раздела: какие
 * у него тексты, какие картинки, какие плитки с цифрами и куда идти за
 * смежным содержимым (вопросы, тарифы), у которого свой полноценный список.
 *
 * Порядок разделов — порядок на самой странице, сверху вниз. Это не
 * косметика: владелец ищет раздел глазами по странице, а не по алфавиту.
 */

import type { ImageSlotKey, TextKey } from "./texts";

/** Одно поле внутри раздела. */
export type SectionField = { kind: "text"; key: TextKey } | { kind: "image"; slot: ImageSlotKey };

/** Подгруппа внутри раздела: «Окно браузера», «Чат бота». */
export type SectionBlock = {
  /** Пусто — поля идут сразу, без подзаголовка. */
  title?: string;
  note?: string;
  fields: SectionField[];
};

export type Section = {
  slug: string;
  /** Название раздела в списке админки. */
  label: string;
  /**
   * Группа в списке: «Главная», «Внутренние страницы», «Общее».
   *
   * Именно укрупнённо, а не «Страница «Пакеты»». Восемь групп по одному
   * пункту, где заголовок дословно повторял название раздела, — это шум:
   * список удлиняется вдвое, а найти в нём ничего не проще.
   */
  place: string;
  /** Адрес страницы — открыть и посмотреть. */
  path: string;
  note: string;
  blocks: SectionBlock[];
  /**
   * Плитки с цифрами внутри раздела. Они часть блока, а не отдельная
   * сущность: заголовок «Что меняется после запуска» и сами числа под ним
   * правятся вместе или не правятся вовсе.
   */
  metricArea?: "home" | "works";
  /**
   * Смежный раздел со своим списком: вопросы, тарифы, услуги. Дублировать
   * их здесь нельзя — получилось бы два места правки одного и того же.
   */
  related?: { label: string; to: string };
};

const t = (key: TextKey): SectionField => ({ kind: "text", key });
const img = (slot: ImageSlotKey): SectionField => ({ kind: "image", slot });

export const SECTIONS: Section[] = [
  {
    slug: "hero",
    label: "Первый экран",
    place: "Главная",
    path: "/",
    note: "Заголовок, кнопки и три макета справа: окно сайта, телефон и чат бота",
    blocks: [
      {
        title: "Заголовок и кнопки",
        fields: [
          t("home.hero.eyebrow"),
          t("home.hero.title"),
          t("home.hero.subtitle"),
          t("home.hero.primaryCta"),
          t("home.hero.secondaryCta"),
        ],
      },
      {
        title: "Окно браузера",
        note: "Снимок сайта клиента и подпись под ним",
        fields: [
          img("home.hero.browser.image"),
          t("home.hero.browser.url"),
          t("home.hero.browser.title"),
          t("home.hero.browser.note"),
          t("home.hero.browser.alt"),
        ],
      },
      {
        title: "Рамка телефона",
        note: "Мобильная версия того же проекта",
        fields: [
          img("home.hero.phone.image"),
          t("home.hero.phone.title"),
          t("home.hero.phone.note"),
          t("home.hero.phone.alt"),
        ],
      },
      {
        title: "Чат бота",
        note: "Короткий диалог: бот уточняет задачу и забирает контакт",
        fields: [
          t("home.hero.chat.name"),
          t("home.hero.chat.badge"),
          t("home.hero.chat.msg1"),
          t("home.hero.chat.msg2"),
          t("home.hero.chat.msg3"),
          t("home.hero.chat.button1"),
          t("home.hero.chat.button2"),
        ],
      },
    ],
  },

  {
    slug: "works",
    label: "Блок работ",
    place: "Главная",
    path: "/",
    note: "Виден, только когда заведён хотя бы один кейс",
    blocks: [
      {
        fields: [
          t("home.works.eyebrow"),
          t("home.works.title"),
          t("home.works.note"),
          t("home.works.cta"),
        ],
      },
    ],
    related: { label: "Сами кейсы", to: "/admin/cases" },
  },

  {
    slug: "process",
    label: "Как работаем",
    place: "Главная",
    path: "/",
    note: "Четыре шага от разбора до развития",
    blocks: [
      { title: "Заголовок", fields: [t("home.process.eyebrow"), t("home.process.title")] },
      {
        title: "Шаг 1",
        fields: [t("home.process.step1.title"), t("home.process.step1.text")],
      },
      {
        title: "Шаг 2",
        fields: [t("home.process.step2.title"), t("home.process.step2.text")],
      },
      {
        title: "Шаг 3",
        fields: [t("home.process.step3.title"), t("home.process.step3.text")],
      },
      {
        title: "Шаг 4",
        fields: [t("home.process.step4.title"), t("home.process.step4.text")],
      },
    ],
  },

  {
    slug: "packages",
    label: "Пакеты и услуги",
    place: "Главная",
    path: "/",
    note: "Заголовки над карточками тарифов",
    blocks: [
      {
        fields: [t("home.packages.eyebrow"), t("home.packages.title"), t("home.packages.note")],
      },
    ],
    related: { label: "Состав и цены тарифов", to: "/admin/content/packages" },
  },

  {
    slug: "metrics",
    label: "Цифры",
    place: "Главная",
    path: "/",
    note: "Заголовок и четыре плитки с числами",
    blocks: [{ fields: [t("home.metrics.eyebrow"), t("home.metrics.title")] }],
    metricArea: "home",
  },

  {
    slug: "home-faq",
    label: "Блок вопросов",
    place: "Главная",
    path: "/",
    note: "Краткая выжимка; какие вопросы показывать — отмечается в их разделе",
    blocks: [{ fields: [t("home.faq.eyebrow"), t("home.faq.title"), t("home.faq.note")] }],
    related: { label: "Сами вопросы и ответы", to: "/admin/content/faq" },
  },

  {
    slug: "lead",
    label: "Блок заявки",
    place: "Общее для всего сайта",
    path: "/contacts",
    note: "Форма и три обещания рядом с ней — правится один раз для всего сайта",
    blocks: [
      {
        title: "Заголовок",
        fields: [t("contact.eyebrow"), t("contact.title"), t("contact.lead")],
      },
      {
        title: "Что будет после отправки",
        note: "Ровно три пункта: список стоит рядом с формой и выровнен с ней по высоте",
        fields: [t("contact.point1"), t("contact.point2"), t("contact.point3")],
      },
      {
        title: "Форма",
        fields: [
          t("contact.taskPlaceholder"),
          t("contact.submit"),
          t("contact.success"),
          t("contact.consent"),
        ],
      },
    ],
  },

  {
    slug: "services-page",
    label: "Шапка страницы услуг",
    place: "Внутренние страницы",
    path: "/services",
    note: "Первый экран раздела с тремя направлениями",
    blocks: [
      {
        fields: [t("page.services.eyebrow"), t("page.services.title"), t("page.services.lead")],
      },
    ],
    related: { label: "Текст каждой услуги", to: "/admin/content/services" },
  },

  {
    slug: "packages-page",
    label: "Страница «Пакеты»",
    place: "Внутренние страницы",
    path: "/packages",
    note: "Шапка и блок «или по отдельности»",
    blocks: [
      {
        title: "Шапка",
        fields: [t("page.packages.eyebrow"), t("page.packages.title"), t("page.packages.lead")],
      },
      {
        title: "Блок «или по отдельности»",
        fields: [
          t("page.packages.singleEyebrow"),
          t("page.packages.singleTitle"),
          t("page.packages.singleLead"),
        ],
      },
    ],
    related: { label: "Состав и цены тарифов", to: "/admin/content/packages" },
  },

  {
    slug: "works-page",
    label: "Страница «Работы»",
    place: "Внутренние страницы",
    path: "/works",
    note: "Шапка и три плитки с числами над сеткой",
    blocks: [{ fields: [t("page.works.eyebrow"), t("page.works.title"), t("page.works.lead")] }],
    metricArea: "works",
    related: { label: "Сами кейсы", to: "/admin/cases" },
  },

  {
    slug: "faq-page",
    label: "Страница «Вопросы»",
    place: "Внутренние страницы",
    path: "/faq",
    note: "Только шапка: сами вопросы правятся в своём разделе",
    blocks: [{ fields: [t("page.faq.eyebrow"), t("page.faq.title"), t("page.faq.lead")] }],
    related: { label: "Сами вопросы и ответы", to: "/admin/content/faq" },
  },

  {
    slug: "contacts-page",
    label: "Страница «Контакты»",
    place: "Внутренние страницы",
    path: "/contacts",
    note: "Шапка над формой заявки",
    blocks: [
      { fields: [t("page.contacts.eyebrow"), t("page.contacts.title"), t("page.contacts.lead")] },
    ],
    related: { label: "Телефон, Telegram и почта", to: "/admin/content/contacts" },
  },

  {
    slug: "industries",
    label: "Страница «Кому подходит»",
    place: "Внутренние страницы",
    path: "/industries",
    note: "Шапка, шесть ниш и блок с маскотом внизу",
    blocks: [
      {
        title: "Шапка",
        fields: [
          t("page.industries.eyebrow"),
          t("page.industries.title"),
          t("page.industries.lead"),
        ],
      },
      {
        title: "Ниша 1",
        fields: [
          t("industries.card1.name"),
          t("industries.card1.tag"),
          t("industries.card1.problem"),
          t("industries.card1.solution"),
        ],
      },
      {
        title: "Ниша 2",
        fields: [
          t("industries.card2.name"),
          t("industries.card2.tag"),
          t("industries.card2.problem"),
          t("industries.card2.solution"),
        ],
      },
      {
        title: "Ниша 3",
        fields: [
          t("industries.card3.name"),
          t("industries.card3.tag"),
          t("industries.card3.problem"),
          t("industries.card3.solution"),
        ],
      },
      {
        title: "Ниша 4",
        fields: [
          t("industries.card4.name"),
          t("industries.card4.tag"),
          t("industries.card4.problem"),
          t("industries.card4.solution"),
        ],
      },
      {
        title: "Ниша 5",
        fields: [
          t("industries.card5.name"),
          t("industries.card5.tag"),
          t("industries.card5.problem"),
          t("industries.card5.solution"),
        ],
      },
      {
        title: "Ниша 6",
        fields: [
          t("industries.card6.name"),
          t("industries.card6.tag"),
          t("industries.card6.problem"),
          t("industries.card6.solution"),
        ],
      },
      {
        title: "Блок внизу",
        fields: [t("industries.band.title"), t("industries.band.text")],
      },
    ],
  },

  {
    slug: "service-cta",
    label: "Призыв на страницах услуг",
    place: "Общее для всего сайта",
    path: "/services/websites/landing",
    note: "Блок «обсудим ваш проект» перед списком соседних услуг",
    blocks: [{ fields: [t("service.cta.title"), t("service.cta.lead")] }],
  },

  {
    slug: "buttons",
    label: "Кнопки по всему сайту",
    place: "Общее для всего сайта",
    path: "/",
    note: "Каждая строка меняется сразу везде, где стоит эта кнопка",
    blocks: [{ fields: [t("cta.primary"), t("cta.works"), t("cta.package"), t("cta.discuss")] }],
  },

  {
    slug: "footer",
    label: "Подвал",
    place: "Общее для всего сайта",
    path: "/",
    note: "Строка о студии рядом с маскотом",
    blocks: [{ fields: [t("footer.tagline")] }],
  },
];

export function sectionBySlug(slug: string): Section | null {
  return SECTIONS.find((section) => section.slug === slug) ?? null;
}

/** Все ключи текстов раздела — для подсчёта изменённого в списке. */
export function sectionTextKeys(section: Section): TextKey[] {
  return section.blocks.flatMap((block) =>
    block.fields
      .filter((f): f is { kind: "text"; key: TextKey } => f.kind === "text")
      .map((f) => f.key),
  );
}

export function sectionImageSlots(section: Section): ImageSlotKey[] {
  return section.blocks.flatMap((block) =>
    block.fields
      .filter((f): f is { kind: "image"; slot: ImageSlotKey } => f.kind === "image")
      .map((f) => f.slot),
  );
}

/** Группировка списка: «Главная» отдельно от внутренних страниц. */
export const SECTION_PLACES: string[] = [...new Set(SECTIONS.map((s) => s.place))];
