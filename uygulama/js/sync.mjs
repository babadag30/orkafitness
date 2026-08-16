/* Orka EMS Fitness — cihazlar arası paylaşılan demo durumu

   ⚠️ Üretim kalıcılığı DEĞİLDİR. Yalnızca işletme sahibi sunumunda iPhone ile
   Mac'in aynı durumu görmesi için. Gerçek yetkilendirme Phase 2'de gelecek.

   Taşıma katmanı üç parçadan oluşur:
     1) Okuma      — Supabase REST (RLS: yalnızca tek demo satırı okunabilir)
     2) Yazma      — Edge Function (iyimser kilit + sunucu tarafı Web Push)
     3) Değişiklik — Supabase Realtime "Postgres Changes"

   Neden Postgres Changes, Broadcast değil:
   Paylaşılan durum tek bir satır. Postgres Changes bu satırın RLS SELECT
   politikasını yetkilendirme olarak zaten kullanıyor; ek bir kimlik katmanı
   gerekmiyor. Broadcast, realtime.messages üzerinde ayrı RLS ve kimlik
   doğrulanmış JWT isterdi — v0.5 §8'in "yalnızca daha ölçeklenebilir diye
   auth karmaşıklığı ekleme" uyarısına aykırı olurdu. */

import { createClient } from '../vendor/supabase.mjs';

const URL = 'https://apahxdkdsvpoejrphkzd.supabase.co';
/* Yayınlanabilir (anon) anahtar — tarayıcıya açık olmak üzere tasarlanmıştır.
   Gizli anahtar, service_role ve VAPID özel anahtarı asla buraya girmez. */
const PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwYWh4ZGtkc3Zwb2VqcnBoa3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTIxOTAsImV4cCI6MjEwMjQyODE5MH0.oBJ5kzRYyPCWmIjQlLxiwNfTIYAhPt3ykLQ2K61pqJo';

const STATE_KEY = 'owner-demo-2026-08-16';
const FN = `${URL}/functions/v1/demo-api`;

const POLL_MS = 1500;          // Realtime kopukken
const POLL_SLOW_MS = 10_000;   // Realtime bağlıyken güvenlik ağı

export const Status = {
  CONNECTING: 'CONNECTING',
  LIVE: 'LIVE',
  SYNCING: 'SYNCING',
  ERROR: 'ERROR'
};

const supabase = createClient(URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } }
});

let revision = 0;
let status = Status.CONNECTING;
let realtimeOk = false;
let pollTimer = null;
let listeners = { state: () => {}, status: () => {} };

export const getRevision = () => revision;
export const getStatus = () => status;

function setStatus(s) {
  if (status === s) return;
  status = s;
  listeners.status(s);
}

/* ------------------------------------------------------------------ */
/* Sunucu çağrıları                                                     */
/* ------------------------------------------------------------------ */

async function call(action, payload = {}, { timeout = 12_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload }),
      signal: ctrl.signal
    });
    const json = await res.json().catch(() => ({}));
    return { httpStatus: res.status, ...json };
  } finally {
    clearTimeout(t);
  }
}

/** Yetkili okuma — REST üzerinden, RLS tek satıra izin veriyor. */
async function fetchState() {
  const res = await fetch(
    `${URL}/rest/v1/owner_demo_state?key=eq.${STATE_KEY}&select=revision,state`,
    { headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` } }
  );
  if (!res.ok) throw new Error(`Durum okunamadı (${res.status})`);
  const rows = await res.json();
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Gelen durum                                                          */
/* ------------------------------------------------------------------ */

function adopt(row, source) {
  if (!row) return false;
  if (row.revision <= revision) return false;   // eski/aynı — yok say
  revision = row.revision;
  listeners.state(row.state, row.revision, source);
  return true;
}

async function refresh(source = 'poll') {
  try {
    const row = await fetchState();
    const changed = adopt(row, source);
    if (status === Status.ERROR || status === Status.SYNCING) {
      setStatus(realtimeOk ? Status.LIVE : Status.SYNCING);
    }
    return changed;
  } catch {
    setStatus(Status.ERROR);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Yoklama — Realtime'a tek başına güvenmiyoruz                         */
/* ------------------------------------------------------------------ */

function schedulePoll() {
  clearTimeout(pollTimer);
  if (document.visibilityState !== 'visible') return;   // arka planda yoklama yok
  const wait = realtimeOk ? POLL_SLOW_MS : POLL_MS;
  pollTimer = setTimeout(async () => { await refresh(); schedulePoll(); }, wait);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { refresh('visible'); schedulePoll(); }
  else clearTimeout(pollTimer);
});

/* ------------------------------------------------------------------ */
/* Başlatma                                                             */
/* ------------------------------------------------------------------ */

export async function init({ onState, onStatus, seed }) {
  listeners = { state: onState, status: onStatus };

  // 1) Açılışta yetkili durumu al
  let row = null;
  try { row = await fetchState(); } catch { setStatus(Status.ERROR); }

  if (!row && typeof seed === 'function') {
    // Paylaşılan durum henüz yok — belirlenimci tohumu bir kez yaz
    const s = seed();
    const r = await call('mutate', {
      expectedRevision: 0,
      mutation: { type: 'RESET_DEMO' },
      state: s,
      actor: 'bootstrap'
    });
    if (r.ok) { revision = r.revision; listeners.state(r.state, r.revision, 'seed'); }
    else { try { row = await fetchState(); } catch { /* yoklama toparlar */ } }
  }

  if (row) adopt(row, 'init');

  // 2) Realtime — tek satırdaki değişiklikleri dinle
  supabase
    .channel('owner-demo-state')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'owner_demo_state', filter: `key=eq.${STATE_KEY}` },
      (payload) => {
        const next = payload.new;
        if (next && typeof next.revision === 'number') adopt(next, 'realtime');
      })
    .subscribe((s) => {
      realtimeOk = s === 'SUBSCRIBED';
      setStatus(realtimeOk ? Status.LIVE : (status === Status.ERROR ? Status.ERROR : Status.SYNCING));
      if (realtimeOk) refresh('resubscribe');   // kopukken kaçırdıklarımızı topla
      schedulePoll();
    });

  schedulePoll();
  return { revision, status };
}

/* ------------------------------------------------------------------ */
/* Yazma — iyimser eşzamanlılık                                         */
/* ------------------------------------------------------------------ */

/**
 * Durumu sunucuya yazar.
 * @param {object} mutation { type, ...bildirim için gereken alanlar }
 * @param {object} state    yeni tam durum
 * @param {string} actor
 * @returns {{ok:boolean, conflict?:boolean, revision:number, push?:object, error?:string}}
 */
export async function push(mutation, state, actor) {
  setStatus(Status.SYNCING);
  let r;
  try {
    r = await call('mutate', { expectedRevision: revision, mutation, state, actor });
  } catch (e) {
    setStatus(Status.ERROR);
    return { ok: false, error: 'Demo bağlantısı kurulamadı. Tekrar deneyin.' };
  }

  if (r.ok) {
    revision = r.revision;
    setStatus(realtimeOk ? Status.LIVE : Status.SYNCING);
    return { ok: true, revision: r.revision, push: r.push };
  }

  if (r.conflict) {
    // Bayat yazma reddedildi. Yetkili durumu benimse, kullanıcı tekrar denesin.
    revision = 0;                       // adopt() yeni sürümü kabul etsin
    adopt({ revision: r.revision, state: r.state }, 'conflict');
    setStatus(realtimeOk ? Status.LIVE : Status.SYNCING);
    return { ok: false, conflict: true, revision: r.revision };
  }

  setStatus(Status.ERROR);
  return { ok: false, error: r.error ?? 'Demo bağlantısı kurulamadı. Tekrar deneyin.' };
}

/* ------------------------------------------------------------------ */
/* Push abonelikleri                                                    */
/* ------------------------------------------------------------------ */

export const health = () => call('health');
export const notificationLog = () => call('log');
export const subscribePush = (memberId, subscription) =>
  call('subscribe', { memberId, subscription, userAgent: navigator.userAgent });
export const unsubscribePush = (endpoint) => call('unsubscribe', { endpoint });
export const testPush = (memberId) => call('testPush', { memberId });

/** Sunumda hata ayıklamak için. */
export const _debug = { supabase, fetchState, call, get revision() { return revision; } };
