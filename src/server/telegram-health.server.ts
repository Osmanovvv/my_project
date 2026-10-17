import { isTelegramDeliveryEnabled, readTelegramBotToken } from "../lib/telegram.server";
import {
  currentTelegramEnvironment,
  getTelegramTransportState,
  type TelegramEnvironment,
} from "./telegram-data.server";

export type TelegramTransportHealth = {
  ok: boolean;
  status: "ok" | "idle" | "degraded" | "not_configured";
  environment: TelegramEnvironment;
  checkedAt: number;
  webhook: { lastReceivedAt: number | null };
  outbox: {
    lastAttemptAt: number | null;
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
    lastStatus: "sent" | "failed" | "unknown" | null;
    lastErrorCode: string | null;
  };
};

/**
 * Безопасный снимок транспорта. Здесь нет токена, chat_id, update id или
 * содержимого сообщений; endpoint можно использовать для мониторинга.
 */
export function getTelegramTransportHealth(
  environment: TelegramEnvironment = currentTelegramEnvironment(),
  now = Date.now(),
): TelegramTransportHealth {
  const state = getTelegramTransportState(environment);
  const configured = isTelegramDeliveryEnabled() && Boolean(readTelegramBotToken());
  const degraded =
    state?.outbox_last_status === "failed" || state?.outbox_last_status === "unknown"
      ? (state.outbox_last_failure_at ?? 0) >= (state.outbox_last_success_at ?? 0)
      : false;
  const status: TelegramTransportHealth["status"] = !configured
    ? "not_configured"
    : degraded
      ? "degraded"
      : state
        ? "ok"
        : "idle";

  return {
    ok: status === "ok" || status === "idle",
    status,
    environment,
    checkedAt: now,
    webhook: { lastReceivedAt: state?.webhook_last_received_at ?? null },
    outbox: {
      lastAttemptAt: state?.outbox_last_attempt_at ?? null,
      lastSuccessAt: state?.outbox_last_success_at ?? null,
      lastFailureAt: state?.outbox_last_failure_at ?? null,
      lastStatus: state?.outbox_last_status ?? null,
      lastErrorCode: state?.outbox_last_error_code || null,
    },
  };
}
