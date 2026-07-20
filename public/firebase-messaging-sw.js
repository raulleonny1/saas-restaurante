/**
 * Service worker mínimo para FCM (registrar en PWA waiter/caja/kitchen).
 * Si no hay firebase config en el SW, el push queda inactivo y el inbox Firestore cubre avisos.
 */
/* eslint-disable no-undef */
self.addEventListener("push", (event) => {
  let title = "SmartServe";
  let body = "Tienes un aviso";
  try {
    const data = event.data?.json?.() ?? {};
    title = data.notification?.title || data.title || title;
    body = data.notification?.body || data.body || body;
  } catch {
    body = event.data?.text?.() || body;
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/waiter"));
});
