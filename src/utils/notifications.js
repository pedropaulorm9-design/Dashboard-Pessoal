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

export function requestNotificationPermission() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        resolve(OneSignal.Notifications.permission);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Igual requestNotificationPermission, mas nunca fica esperando pra
 * sempre — se o SDK do OneSignal não responder em alguns segundos
 * (bloqueador de anúncio, conexão ruim, etc.), resolve com 'timeout'
 * em vez de travar o botão pra sempre sem nenhum aviso.
 */
export function requestNotificationPermissionSafe(timeoutMs = 6000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve('timeout');
      }
    }, timeoutMs);

    requestNotificationPermission().then((granted) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(granted);
      }
    });
  });
}

export function getNotificationPermission() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      resolve(OneSignal.Notifications.permission);
    });
  });
}

export function getOptedIn() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      resolve(Boolean(OneSignal.User.PushSubscription.optedIn));
    });
  });
}

export function setOptedIn(enabled) {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      if (enabled) {
        await OneSignal.User.PushSubscription.optIn();
      } else {
        await OneSignal.User.PushSubscription.optOut();
      }
      resolve(enabled);
    });
  });
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
