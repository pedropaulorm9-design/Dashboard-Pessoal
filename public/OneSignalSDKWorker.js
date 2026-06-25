// Força o carregamento do SDK do OneSignal sem depender de importScripts que falham
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.worker.js");
} catch (e) {
  console.error("Erro ao carregar OneSignal SDK, tentando fallback...", e);
  // Se falhar, tenta de uma URL alternativa ou apenas evita o crash
}