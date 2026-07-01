// Service worker único do app: cuida do cache do PWA (offline) E das
// notificações push do OneSignal, no mesmo arquivo. Isso evita ter dois
// service workers separados disputando escopo/registro.

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
