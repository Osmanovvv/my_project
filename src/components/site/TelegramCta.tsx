import type { ReactNode } from "react";
import { Send } from "lucide-react";
import { buildTelegramDeepLink, type TelegramLinkSource } from "../../lib/telegram-links";

type Props = {
  source: TelegramLinkSource;
  children: ReactNode;
  className?: string;
  /** Внешняя ссылка получает отдельную подпись для скринридеров. */
  ariaLabel?: string;
  icon?: boolean;
};

/** Единый внешний CTA в Telegram с безопасной статической source-разметкой. */
export function TelegramCta({ source, children, className = "", ariaLabel, icon = true }: Props) {
  return (
    <a
      href={buildTelegramDeepLink(source)}
      target="_blank"
      rel="noopener noreferrer"
      data-telegram-source={source}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 ${className}`.trim()}
    >
      {icon && <Send className="h-4 w-4" aria-hidden="true" />}
      {children}
    </a>
  );
}
