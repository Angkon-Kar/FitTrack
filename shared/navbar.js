// shared/navbar.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { sb } from './db.js';

if (typeof CONFIG === 'undefined') {
  throw new Error("FitTrack: Fill in config.local.js with your Firebase + Supabase credentials.");
}

const firebaseApp = initializeApp(CONFIG.firebase);
const auth = getAuth(firebaseApp);

const depth = (window.location.pathname.match(/\//g) || []).length - 1;
const root  = depth === 0 ? './' : '../'.repeat(depth);

function isActive(href) {
  const p = window.location.pathname;
  if (href === root)
    return p === '/' || p.endsWith('/index.html') || (p.endsWith('/') && !p.includes('/auth/') && !p.includes('/dashboard/') && !p.includes('/exercises/') && !p.includes('/blog/') && !p.includes('/compare/') && !p.includes('/profile/'));
  return p.includes(href.replace(root,'').replace('../','').replace('.html',''));
}
const nl = (href, icon, label) =>
  `<li><a href="${root}${href}"${isActive(root+href)?' class="active"':''}>${icon} ${label}</a></li>`;
const dl = (href, icon, label) =>
  `<a href="${root}${href}"${isActive(root+href)?' class="active"':''}>${icon} ${label}</a>`;

document.body.insertAdjacentHTML('afterbegin', `
<nav class="navbar" id="mainNav">
  <div class="nav-inner">
    <a href="${root}" class="nav-logo">FIT<span class="dot">.</span>TRACK</a>
    <ul class="nav-links">
      ${nl('','🏠','Home')}
      ${nl('exercises/','💪','Exercises')}
      ${nl('blog/','📝','Blog')}
      ${nl('compare/','⚔️','Compare')}
      ${nl('dashboard/','📊','Dashboard')}
    </ul>
    <div class="nav-right">
      <button class="theme-toggle" id="themeToggle" title="Toggle theme"><span id="themeIcon">🌙</span></button>
      <div id="navGuest" style="display:flex;gap:8px">
        <a href="${root}auth/login.html"  class="btn btn-outline btn-sm">Sign In</a>
        <a href="${root}auth/signup.html" class="btn btn-lime btn-sm">Start Free</a>
      </div>
      <div id="navUser" style="display:none;gap:10px;align-items:center">
        <a href="${root}profile/" class="nav-profile-link" id="navProfileLink" title="My Profile">
          <div id="navProfileBubble" class="nav-profile-bubble">
            <img id="navProfileImg" src="" alt="" style="display:none;width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border-mid)">
            <div id="navAvatar" class="nav-user-avatar" style="display:flex">?</div>
          </div>
        </a>
        <a href="${root}dashboard/log.html" class="btn btn-lime btn-sm">+ Log</a>
        <button id="navLogout" class="btn btn-ghost btn-sm">Sign Out</button>
      </div>
      <button class="nav-hamburger" id="navHamburger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="nav-drawer" id="navDrawer">
  ${dl('','🏠','Home')}
  ${dl('exercises/','💪','Exercises')}
  ${dl('blog/','📝','Blog')}
  ${dl('compare/','⚔️','Compare')}
  ${dl('dashboard/','📊','Dashboard')}
  ${dl('dashboard/log.html','✏️','Log Workout')}
  ${dl('profile/','👤','My Profile')}
  <div class="nav-drawer-divider"></div>
  <button id="drawerThemeBtn" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:8px;background:none;border:none;color:var(--text-2);font-size:15px;font-weight:500;cursor:pointer;width:100%;text-align:left">
    <span id="drawerThemeIcon">🌙</span><span id="drawerThemeLabel">Switch to Light Mode</span>
  </button>
  <div class="nav-drawer-divider"></div>
  <div id="drawerGuest" style="display:flex;flex-direction:column;gap:6px">
    <a href="${root}auth/login.html">🔑 Sign In</a>
    <a href="${root}auth/signup.html" style="color:var(--lime)">⚡ Create Free Account</a>
  </div>
  <div id="drawerUser" style="display:none;flex-direction:column;gap:6px">
    <a href="${root}profile/">👤 My Profile</a>
    <a href="${root}dashboard/">📊 My Dashboard</a>
    <a href="#" id="drawerLogout" style="color:var(--coral)">🚪 Sign Out</a>
  </div>
</div>
<div id="navToast" class="toast"></div>`);

// Favicon
if (!document.querySelector("link[rel~='icon']")) {
  const l = document.createElement('link');
  l.rel='icon'; l.type='image/png'; l.href=root+'assets/images/fitness.png';
  document.head.appendChild(l);
}

// Theme
const THEME_KEY = 'fittrack-theme';
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
  const dark = t === 'dark';
  document.getElementById('themeIcon').textContent        = dark ? '🌙' : '☀️';
  document.getElementById('drawerThemeIcon').textContent  = dark ? '🌙' : '☀️';
  document.getElementById('drawerThemeLabel').textContent = dark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
document.getElementById('themeToggle').onclick    = () => applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
document.getElementById('drawerThemeBtn').onclick = () => document.getElementById('themeToggle').click();

// Hamburger
document.getElementById('navHamburger').addEventListener('click', () => {
  document.getElementById('navDrawer').classList.toggle('open');
  document.getElementById('navHamburger').classList.toggle('open');
});
document.querySelectorAll('#navDrawer a').forEach(a =>
  a.addEventListener('click', () => {
    document.getElementById('navDrawer').classList.remove('open');
    document.getElementById('navHamburger').classList.remove('open');
  })
);

// Auth + profile
// ── Set nav profile (photo or initial) ────────────────────
function setNavProfile(photoURL, displayName) {
  const img     = document.getElementById('navProfileImg');
  const initial = document.getElementById('navAvatar');
  const letter  = (displayName || '?')[0].toUpperCase();
  initial.textContent = letter;
  if (photoURL) {
    img.src = photoURL;
    img.onload = () => { img.style.display = 'block'; initial.style.display = 'none'; };
    img.onerror = () => { img.style.display = 'none'; initial.style.display = 'flex'; };
    // If already cached
    if (img.complete && img.naturalWidth) { img.style.display = 'block'; initial.style.display = 'none'; }
  } else {
    img.style.display = 'none';
    initial.style.display = 'flex';
  }
}

onAuthStateChanged(auth, async user => {
  const gEl = document.querySelectorAll('#navGuest,#drawerGuest');
  const uEl = document.querySelectorAll('#navUser,#drawerUser');
  if (user) {
    gEl.forEach(e => e.style.display='none');
    uEl.forEach(e => e.style.display='flex');

    // Show photo from Firebase immediately
    setNavProfile(user.photoURL, user.displayName);

    // Load from Supabase
    const { data } = await sb.from('users').select('name,username,profile_picture,username_set').eq('firebase_uid', user.uid).maybeSingle();

    if (data) {
      const displayName = data.name || user.displayName || '';


      // Prefer Supabase stored photo, fallback to Firebase
      setNavProfile(data.profile_picture || user.photoURL, data.name || user.displayName);

      // Toast if username not set (show once per session)
      if (!data.username_set && !sessionStorage.getItem('ft-username-toast')) {
        sessionStorage.setItem('ft-username-toast', '1');
        setTimeout(() => showNavToast('👤 Set your username so friends can find you!', 'info', root + 'profile/'), 2000);
      }
    } else {
      // First login — auto-create user record
      const username_guess = (user.displayName||user.email||'').toLowerCase().replace(/[^a-z0-9]/g,'_').substring(0,15) || 'user';
      await sb.from('users').insert({
        firebase_uid: user.uid,
        name: user.displayName || '',
        email: user.email || '',
        profile_picture: user.photoURL || '',
        username: null,
        username_set: false
      });
      setNavProfile(user.photoURL, user.displayName);

      if (!sessionStorage.getItem('ft-username-toast')) {
        sessionStorage.setItem('ft-username-toast', '1');
        setTimeout(() => showNavToast('👋 Welcome! Set your username in your profile.', 'info', root + 'profile/'), 1500);
      }
    }
  } else {
    gEl.forEach(e => e.style.display='flex');
    uEl.forEach(e => e.style.display='none');
  }
});

function showNavToast(msg, type, link) {
  const t = document.getElementById('navToast');
  if (link) {
    t.innerHTML = `${msg} <a href="${link}" style="color:var(--lime);font-weight:700;margin-left:8px">Edit →</a>`;
  } else {
    t.textContent = msg;
  }
  t.className = `toast ${type} visible`;
  setTimeout(() => t.classList.remove('visible'), 5000);
}

document.getElementById('navLogout')?.addEventListener('click',  () => signOut(auth).then(()=>window.location.href=root));
document.getElementById('drawerLogout')?.addEventListener('click', e => { e.preventDefault(); signOut(auth).then(()=>window.location.href=root); });

export { auth, sb, onAuthStateChanged, signOut, firebaseApp };

// পেজ পুরোপুরি লোড হওয়ার পর স্ক্রিপ্টটি কাজ করবে
document.addEventListener("DOMContentLoaded", () => {
  
  // ১. মডালের HTML তৈরি করে <body> এর শেষে বসিয়ে দেওয়া
  const modalHTML = `
    <div id="imageModal" class="modal">
      <span class="close-modal">&times;</span>
      <img class="modal-content" id="enlargedImg">
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // ২. এলিমেন্টগুলো সিলেক্ট করা
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("enlargedImg");
  const closeBtn = document.querySelector(".close-modal");

  // ৩. তোমার পেজের সব ইমেজ খুঁজে বের করা (যেগুলোতে তুমি ক্লিক করতে চাও)
  // নোট: তুমি চাইলে শুধু নির্দিষ্ট ক্লাসের (.zoomable-img) ইমেজ সিলেক্ট করতে পারো। 
  // কিন্তু ৩৫ পেজে ক্লাস বসাতে না চাইলে, নিচের লাইনটি তোমার কন্টেন্ট এরিয়ার সব ইমেজকে টার্গেট করবে।
  const images = document.querySelectorAll("img.zoomable-img"); 

  images.forEach(img => {
    img.addEventListener("click", function() {
      modal.classList.add("show");
      modalImg.src = this.src;
    });
  });

  // close button
  function closeModal() {
    modal.classList.remove("show");
    setTimeout(() => { modal.style.display = "none"; }, 300); // অ্যানিমেশন শেষ হওয়ার পর display none
  }

  closeBtn.addEventListener("click", closeModal);
  
  modal.addEventListener("click", function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // ESC বাটন চাপলেও যাতে মডাল বন্ধ হয়
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeModal();
    }
  });
});