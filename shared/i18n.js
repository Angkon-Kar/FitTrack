/**
 * FitTrack i18n System
 * Supports: en (English), bn (Bangla/Bengali)
 * Usage:
 *   import { t, setLang, initI18n } from '../shared/i18n.js';
 *   await initI18n();
 *   element.textContent = t('dashboard.welcomeBack');
 */

const SUPPORTED_LANGS = ['en', 'bn'];
const DEFAULT_LANG    = 'en';
const STORAGE_KEY     = 'ft-lang';

// Detect base path dynamically (works on localhost & Vercel)
function getBasePath() {
  // __BASE_PATH__ is injected by config.local.js or falls back to origin
  if (typeof __BASE_PATH__ !== 'undefined') return __BASE_PATH__;
  // Auto-detect: find /shared/ in current script path
  const scripts = document.querySelectorAll('script[src]');
  for (const s of scripts) {
    const m = s.src.match(/^(https?:\/\/[^/]+)(\/.*?)\/shared\/i18n\.js/);
    if (m) return m[1] + m[2];
  }
  return window.location.origin;
}

let _translations = {};
let _lang = DEFAULT_LANG;
let _initialized = false;
const _listeners = [];

// ── Public API ────────────────────────────────────────────

/**
 * Initialize i18n — call once on page load.
 * Reads saved language from localStorage, fetches JSON.
 */
export async function initI18n() {
  if (_initialized) return;
  const saved = localStorage.getItem(STORAGE_KEY);
  _lang = SUPPORTED_LANGS.includes(saved) ? saved : detectBrowserLang();
  await loadTranslations(_lang);
  _initialized = true;
  applyTranslations();
}

/**
 * Get a translation string by dot-notation key.
 * Falls back to English key, then the key itself.
 * @param {string} key  e.g. 'dashboard.welcomeBack'
 * @param {Object} vars  e.g. { name: 'Rahim' } → replaces {{name}}
 */
export function t(key, vars = {}) {
  const val = getNestedKey(_translations, key)
    ?? getNestedKey(_fallback, key)
    ?? key;
  return interpolate(val, vars);
}

/**
 * Change language and re-render all [data-i18n] elements.
 * Persists to localStorage.
 */
export async function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  if (lang === _lang && _initialized) return;
  _lang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  await loadTranslations(lang);
  applyTranslations();
  _listeners.forEach(fn => fn(lang));
  // Update <html lang> attribute
  document.documentElement.lang = lang;
}

/** Get current language code */
export function getLang() { return _lang; }

/** Subscribe to language changes */
export function onLangChange(fn) { _listeners.push(fn); }

// ── Internal ──────────────────────────────────────────────

let _fallback = {}; // English fallback

async function loadTranslations(lang) {
  const base = getBasePath();
  try {
    // Always load English as fallback first (cached after first load)
    if (!Object.keys(_fallback).length || lang === 'en') {
      const enRes = await fetch(`${base}/locales/en.json`);
      if (!enRes.ok) throw new Error(`en.json not found (${enRes.status})`);
      _fallback = await enRes.json();
    }

    if (lang === 'en') {
      _translations = _fallback;
      return;
    }

    const res = await fetch(`${base}/locales/${lang}.json`);
    if (!res.ok) throw new Error(`${lang}.json not found (${res.status})`);
    _translations = await res.json();

  } catch (err) {
    console.warn('[i18n] Failed to load translations:', err.message);
    _translations = _fallback;
  }
}

/**
 * Apply translations to all DOM elements with [data-i18n].
 *
 * HTML usage:
 *   <span data-i18n="dashboard.welcomeBack"></span>
 *   <input data-i18n-placeholder="log.searchPlaceholder">
 *   <button data-i18n="common.save" data-i18n-attr="title"></button>
 */
function applyTranslations() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (val !== key) el.textContent = val;
  });

  // Placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const val = t(key);
    if (val !== key) el.placeholder = val;
  });

  // Title / aria-label / any attribute
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const attr = el.dataset.i18nAttr;
    const key  = el.dataset.i18n || el.dataset.i18nAttrKey;
    if (attr && key) { const val = t(key); if (val !== key) el.setAttribute(attr, val); }
  });

  // HTML content (use carefully, content must be trusted)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    const val = t(key);
    if (val !== key) el.innerHTML = val;
  });

  // Font adjustment for Bangla
  if (_lang === 'bn') {
    document.body.classList.add('lang-bn');
    document.body.classList.remove('lang-en');
  } else {
    document.body.classList.add('lang-en');
    document.body.classList.remove('lang-bn');
  }
}

function getNestedKey(obj, key) {
  if (!obj || !key) return undefined;
  return key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

function interpolate(str, vars) {
  if (!str || !Object.keys(vars).length) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function detectBrowserLang() {
  const nav = navigator.language || navigator.userLanguage || 'en';
  const code = nav.toLowerCase().split('-')[0];
  return SUPPORTED_LANGS.includes(code) ? code : DEFAULT_LANG;
}