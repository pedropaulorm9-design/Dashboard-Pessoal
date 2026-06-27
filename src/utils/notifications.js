/**
 * Converte uma data (YYYY-MM-DD) + horário (HH:mm) no formato que a
 * API do OneSignal espera pro campo send_after, já considerando o
 * fuso horário local de quem está usando o app.
 */
export function toOneSignalSendAfter(dateKey, time) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const local = new Date(year, month - 1, day, hour, minute, 0);

  const offsetMin = -local.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const pad = (n) => String(n).padStart(2, '0');

  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00 GMT${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

/**
 * Roda uma função que recebe o objeto OneSignal já carregado, mas nunca
 * fica esperando pra sempre — se a fila do SDK não processar em alguns
 * segundos (bloqueador de anúncio, SDK que falhou ao carregar, conexão
 * ruim), resolve com `fallback` em vez de travar a tela pra sempre sem
 * nenhum aviso. Todas as chamadas ao OneSignal nesse arquivo passam por
 * aqui, já que qualquer uma delas pode sofrer do mesmo travamento.
 */
function withOneSignal(callback, fallback, timeoutMs = 6000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        const result = await callback(OneSignal);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      }
    });
  });
}

export function requestNotificationPermission() {
  return withOneSignal(async (OneSignal) => {
    await OneSignal.Notifications.requestPermission();
    return OneSignal.Notifications.permission;
  }, false);
}

/**
 * Igual requestNotificationPermission, mas devolve o texto 'timeout'
 * (em vez de só `false`) quando quem travou foi a comunicação com o
 * SDK — assim a tela consegue mostrar uma mensagem diferente de
 * "permissão negada".
 */
export function requestNotificationPermissionSafe(timeoutMs = 6000) {
  return withOneSignal(async (OneSignal) => {
    await OneSignal.Notifications.requestPermission();
    return OneSignal.Notifications.permission;
  }, 'timeout', timeoutMs);
}

export function getNotificationPermission() {
  return withOneSignal((OneSignal) => OneSignal.Notifications.permission, false);
}

export function getOptedIn() {
  return withOneSignal((OneSignal) => Boolean(OneSignal.User.PushSubscription.optedIn), false);
}

export function setOptedIn(enabled) {
  return withOneSignal(async (OneSignal) => {
    if (enabled) {
      await OneSignal.User.PushSubscription.optIn();
    } else {
      await OneSignal.User.PushSubscription.optOut();
    }
    return enabled;
  }, 'timeout');
}

export async function scheduleTaskNotification({ title, message, sendAfter }) {
  const res = await fetch('/api/schedule-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message, sendAfter }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id || null;
}

export async function cancelTaskNotification(notificationId) {
  if (!notificationId) return;
  await fetch('/api/cancel-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationId }),
  }).catch(() => {});
}
