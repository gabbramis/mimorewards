export interface PushQuotaInfo {
  allowedPerWeek: number;
  sentThisWeek: number;
  availableThisWeek: number;
  canSendNow: boolean;
  nextAvailableAt: string | null;
  cooldownHoursRemaining: number;
}

/**
 * Calcula el límite de envíos manuales anti-spam:
 * - Máximo 2 envíos manuales por semana por comercio
 * - Mínimo 72 horas (3 días) entre cada envío masivo
 */
export function calculatePushQuota(history: Array<{ created_at: string }>): PushQuotaInfo {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  // Filtrar logs de los últimos 7 días ordenados de más reciente a más antiguo
  const recentLogs = (history || [])
    .filter((h) => new Date(h.created_at).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const sentThisWeek = recentLogs.length;
  const availableThisWeek = Math.max(0, 2 - sentThisWeek);
  const minIntervalMs = 72 * 60 * 60 * 1000; // 72 horas (3 días)

  // Obtener el último envío registrado en toda la historia reciente
  const lastLog = recentLogs[0] || (history && history.length > 0 ? history[0] : null);
  let canSendNow = true;
  let nextAvailableAt: string | null = null;
  let cooldownHoursRemaining = 0;

  if (lastLog) {
    const lastTime = new Date(lastLog.created_at).getTime();
    const diffMs = now - lastTime;
    if (diffMs < minIntervalMs) {
      canSendNow = false;
      nextAvailableAt = new Date(lastTime + minIntervalMs).toISOString();
      cooldownHoursRemaining = Math.max(1, Math.ceil((minIntervalMs - diffMs) / (1000 * 60 * 60)));
    }
  }

  if (canSendNow && sentThisWeek >= 2) {
    canSendNow = false;
    const oldestInWeek = recentLogs[recentLogs.length - 1];
    if (oldestInWeek) {
      nextAvailableAt = new Date(new Date(oldestInWeek.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  return {
    allowedPerWeek: 2,
    sentThisWeek,
    availableThisWeek,
    canSendNow,
    nextAvailableAt,
    cooldownHoursRemaining,
  };
}
