const fs = require('fs');

// Netlify/Vercel-এর এনভায়রনমেন্ট ভেরিয়েবলগুলো পড়ে কনফিগ ফাইল তৈরি করবে
const configContent = `
const CONFIG = {
    SUPABASE_URL: "${process.env.SUPABASE_URL}",
    SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY}",
    FIREBASE_API_KEY: "${process.env.FIREBASE_API_KEY}",
    FIREBASE_AUTH_DOMAIN: "${process.env.FIREBASE_AUTH_DOMAIN}",
    FIREBASE_PROJECT_ID: "${process.env.FIREBASE_PROJECT_ID}",
    FIREBASE_STORAGE_BUCKET: "${process.env.FIREBASE_STORAGE_BUCKET}",
    FIREBASE_MESSAGING_SENDER_ID: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
    FIREBASE_APP_ID: "${process.env.FIREBASE_APP_ID}"
};
`;

// config.local.js ফাইলটি তৈরি করা হচ্ছে
fs.writeFileSync('./config.local.js', configContent);
console.log("config.local.js successfully generated!");