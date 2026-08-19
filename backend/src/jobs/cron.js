import cron from "node-cron";
import { runSync } from "../services/sync.js";
import { runKommoSync } from "../services/kommoSync.js";

// Todos os dias às 08:00, horário do servidor. Se a hospedagem rodar em UTC
// (padrão no Render/Railway), ajuste a expressão para bater com o horário de Brasília
// (UTC-3): 08:00 BRT = 11:00 UTC → '0 11 * * *'.
export function scheduleDailySync() {
  cron.schedule("0 11 * * *", async () => {
    try {
      const result = await runSync({ triggeredBy: "cron_08h" });
      console.log("[cron 08h] sync Meta concluída:", result);
    } catch (err) {
      console.error("[cron 08h] sync Meta falhou:", err.message || err);
      // TODO: plugar alerta (e-mail/webhook) aqui quando a rotina falhar —
      // sem isso, uma falha passa despercebida por dias.
    }

    try {
      const result = await runKommoSync();
      console.log("[cron 08h] sync Kommo concluída:", result);
    } catch (err) {
      console.error("[cron 08h] sync Kommo falhou:", err.message || err);
    }
  });
}
