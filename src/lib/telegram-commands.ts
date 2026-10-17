/**
 * Единый список команд клиентского бота.
 *
 * Здесь хранится именно меню команд Telegram. Реакции на команды будут
 * подключены вместе с обработчиком входящих update на этапе 5.
 */
export const TELEGRAM_COMMANDS = [
  { command: "start", description: "Открыть главное меню" },
  { command: "help", description: "Помощь и контакты" },
  { command: "request", description: "Создать новую заявку" },
  { command: "status", description: "Мои обращения и статусы" },
  { command: "cancel", description: "Отменить текущее действие" },
] as const;

/** Формат для вставки в @BotFather через /setcommands. */
export const TELEGRAM_COMMANDS_TEXT = TELEGRAM_COMMANDS.map(
  ({ command, description }) => `${command} - ${description}`,
).join("\n");

/**
 * Команды для chat-scoped меню единственного оператора.
 *
 * Telegram применяет этот список только к подтверждённому личному чату
 * оператора; клиентский список выше остаётся отдельным и не показывает /admin.
 */
export const TELEGRAM_OPERATOR_COMMANDS = [
  ...TELEGRAM_COMMANDS,
  { command: "admin", description: "Открыть меню оператора" },
] as const;

export const TELEGRAM_OPERATOR_COMMANDS_TEXT = TELEGRAM_OPERATOR_COMMANDS.map(
  ({ command, description }) => `${command} - ${description}`,
).join("\n");
