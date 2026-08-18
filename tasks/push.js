// ---- Push-нагадування: клієнтська частина ----
// Дозвіл, токен пристрою і його збереження у Firestore. Саму розсилку робить
// Cloud Function (reminders.js у корені) — тут лише «цей пристрій готовий
// приймати сповіщення».
//
// Свідомо жодного автоматичного запиту дозволу при завантаженні: браузери
// (і люди) однаково не люблять спливаючі вікна нізвідки, а iOS показує
// запит лише у відповідь на дію користувача.
(function () {
  'use strict';

  var SW_PATH = 'firebase-messaging-sw.js';
  // Окремий scope від офлайн-кешу модуля: два SW з однаковим scope не
  // співіснують, пізніша реєстрація витісняє попередню.
  var SW_SCOPE = 'push/';

  // Причини, з яких push тут неможливий у принципі — їх треба показати
  // людині, а не мовчки нічого не робити.
  function pushSupport() {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    if (!('Notification' in window)) return 'unsupported';
    if (!('PushManager' in window)) return 'unsupported';
    if (typeof firebase === 'undefined' || !firebase.messaging) return 'unsupported';
    // На iOS web push працює лише для застосунку, доданого на домашній екран.
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (isIOS && !standalone) return 'ios-needs-install';
    return 'ok';
  }

  function permissionState() {
    return ('Notification' in window) ? Notification.permission : 'unsupported';
  }

  /**
   * Запитує дозвіл (якщо треба), бере токен FCM і зберігає його у Firestore.
   * Викликати ЛИШЕ з обробника кліку — інакше iOS проігнорує запит.
   * Повертає { ok: true, token } або { ok: false, reason }.
   */
  async function enablePush(db, uid) {
    var support = pushSupport();
    if (support !== 'ok') return { ok: false, reason: support };
    if (!uid) return { ok: false, reason: 'no-user' };
    if (typeof FCM_VAPID_KEY !== 'string' || !FCM_VAPID_KEY || FCM_VAPID_KEY.indexOf('ВСТАВ') === 0) {
      return { ok: false, reason: 'no-vapid-key' };
    }

    var permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    try {
      var registration = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
      // getToken падає, якщо SW ще не активний — чекаємо на готовність.
      await navigator.serviceWorker.ready;
      var token = await firebase.messaging().getToken({
        vapidKey: FCM_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (!token) return { ok: false, reason: 'no-token' };

      // Ідентифікатор документа — сам токен: повторний вхід із того самого
      // пристрою перезаписує запис, а не плодить дублікати.
      await db.collection('users').doc(uid).collection('fcmTokens').doc(token).set({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ua: (navigator.userAgent || '').slice(0, 500),
        tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 60),
      });
      return { ok: true, token: token };
    } catch (err) {
      console.error('enablePush:', err);
      return { ok: false, reason: 'error', error: err };
    }
  }

  /** Прибирає токен цього пристрою — «більше не надсилати сюди». */
  async function disablePush(db, uid) {
    try {
      if (typeof firebase === 'undefined' || !firebase.messaging) return { ok: true };
      var token = await firebase.messaging().getToken({ vapidKey: FCM_VAPID_KEY }).catch(function () { return null; });
      if (token && uid) {
        await db.collection('users').doc(uid).collection('fcmTokens').doc(token).delete().catch(function () {});
      }
      await firebase.messaging().deleteToken().catch(function () {});
      return { ok: true };
    } catch (err) {
      console.error('disablePush:', err);
      return { ok: false, reason: 'error', error: err };
    }
  }

  /**
   * Повідомлення, що прийшло, коли вкладка відкрита. Системного сповіщення
   * браузер у цьому випадку не показує — SW його не бачить, тож показуємо
   * самі, інакше нагадування «губиться» саме тоді, коли людина за застосунком.
   */
  function listenForeground(onMessage) {
    if (typeof firebase === 'undefined' || !firebase.messaging) return;
    try {
      firebase.messaging().onMessage(function (payload) {
        onMessage((payload && payload.data) || {});
      });
    } catch (err) {
      console.warn('listenForeground:', err);
    }
  }

  window.pushSupport = pushSupport;
  window.pushPermission = permissionState;
  window.enablePush = enablePush;
  window.disablePush = disablePush;
  window.listenForegroundPush = listenForeground;
})();
