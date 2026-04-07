import { api } from './api';

const SW_PATH = '/sw.js';

/** Converte ArrayBuffer em Base64url string (formato esperado pelo backend) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Retorna true se o browser suporta Push + Service Worker */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Registra o Service Worker e retorna o registro. */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH);
}

/** Busca a VAPID public key do backend. */
async function fetchPublicKey(): Promise<string> {
  const res = await api.get<{ publicKey: string }>('/push/public-key');
  return res.data.publicKey;
}

/**
 * Solicita permissão e faz subscribe.
 * Retorna o endpoint da subscription ou null se o usuário recusar.
 */
export async function subscribeToPush(): Promise<string | null> {
  if (!isPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const [reg, publicKey] = await Promise.all([getRegistration(), fetchPublicKey()]);
  if (!publicKey) return null;

  // Converte a VAPID public key de Base64url para Uint8Array
  const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
  const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawKey = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: rawKey,
  });

  const json = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  await api.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: json.keys,
  });

  return json.endpoint;
}

/**
 * Remove a subscription do browser e do backend.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return;

  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.delete('/push/subscribe', { data: { endpoint } });
}

/**
 * Verifica se o browser está atualmente subscrito.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return false;

  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}
