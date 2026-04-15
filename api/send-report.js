// api/send-report.js
// Vercel Serverless Function — sends workout analysis report via Resend
// Deploy on Vercel. Set RESEND_API_KEY in Vercel environment variables.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { email, name, period, periodLabel, logs } = req.body;

  if (!email || !logs || !period) {
    res.status(400).json({ error: 'Missing required fields: email, logs, period' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'RESEND_API_KEY not configured on server' });
    return;
  }

  // ── Build analysis data ──────────────────────────────
  const analysis = analyzeWorkouts(logs);
  const html = buildEmailHTML(name, periodLabel, analysis, logs);

  // ── Send via Resend ──────────────────────────────────
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FitTrack Reports <reports@myfittrackpro.netlify.app>',
        to:   [email],
        subject: `📊 Your ${periodLabel} Fitness Report — FitTrack`,
        html: html,
      }),
    });

    const result = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', result);
      res.status(500).json({ error: result.message || 'Failed to send email' });
      return;
    }

    res.status(200).json({ success: true, id: result.id });

  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Analysis Engine ────────────────────────────────────────
function analyzeWorkouts(logs) {
  if (!logs || !logs.length) return null;

  const PUSH_EX  = ['push-up','diamond-push-up','incline-push-up','decline-push-up','pike-push-up','dips','hspu','planche'];
  const PULL_EX  = ['pull-up','chin-up','bodyweight-row','muscle-up','front-lever'];
  const LEGS_EX  = ['squat','lunges','bulgarian-split-squat','calf-raises','glute-bridge','pistol-squat','jump-squats'];
  const CORE_EX  = ['plank','sit-ups','crunches','russian-twist','hanging-leg-raises','bicycle-crunch','l-sit'];
  const CARDIO_EX= ['burpees','jumping-jacks','high-knees','mountain-climbers'];

  let totals = { push:0, pull:0, legs:0, core:0, cardio:0, other:0 };
  let exTotals = {};
  let dailyTotals = [];
  let allExercises = new Set();

  logs.forEach(log => {
    const ex = log.exercises || {};
    let dayTotal = 0;
    Object.entries(ex).forEach(([key, val]) => {
      exTotals[key] = (exTotals[key] || 0) + val;
      allExercises.add(key);
      dayTotal += val;
      if      (PUSH_EX.includes(key))   totals.push   += val;
      else if (PULL_EX.includes(key))   totals.pull   += val;
      else if (LEGS_EX.includes(key))   totals.legs   += val;
      else if (CORE_EX.includes(key))   totals.core   += val;
      else if (CARDIO_EX.includes(key)) totals.cardio += val;
      else                               totals.other  += val;
    });
    dailyTotals.push({ date: log.log_date, total: dayTotal, exercises: Object.keys(ex).length });
  });

  const grandTotal = Object.values(totals).reduce((a,b)=>a+b,0);
  const avgPerDay  = logs.length ? Math.round(grandTotal / logs.length) : 0;
  const maxDay     = dailyTotals.reduce((a,b) => b.total > a.total ? b : a, dailyTotals[0]);
  const topExercises = Object.entries(exTotals).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Consistency: active days / total days in period
  const sorted = [...logs].sort((a,b) => new Date(a.log_date) - new Date(b.log_date));
  const firstDate = new Date(sorted[0].log_date + 'T00:00:00');
  const lastDate  = new Date();
  const periodDays = Math.max(1, Math.round((lastDate - firstDate) / 864e5) + 1);
  const consistency = Math.round((logs.length / periodDays) * 100);

  // Weekly comparison (last 7 days vs 7 days before)
  const now = new Date();
  const week1 = logs.filter(l => new Date(l.log_date+'T00:00:00') >= new Date(now - 7*864e5));
  const week2 = logs.filter(l => {
    const d = new Date(l.log_date+'T00:00:00');
    return d >= new Date(now - 14*864e5) && d < new Date(now - 7*864e5);
  });
  const w1Total = week1.reduce((s,l)=>s+Object.values(l.exercises||{}).reduce((a,b)=>a+b,0),0);
  const w2Total = week2.reduce((s,l)=>s+Object.values(l.exercises||{}).reduce((a,b)=>a+b,0),0);
  const weeklyChange = w2Total > 0 ? Math.round(((w1Total - w2Total) / w2Total) * 100) : null;

  return {
    totals, grandTotal, avgPerDay, maxDay, topExercises,
    allExercises: [...allExercises],
    workoutDays: logs.length, consistency,
    weeklyChange, w1Total, w2Total,
    dailyTotals: dailyTotals.slice(-14), // last 14 days for chart
    periodDays,
  };
}

// ── Email HTML Builder ─────────────────────────────────────
function buildEmailHTML(name, periodLabel, a, logs) {
  if (!a) return '<p>No workout data found for this period.</p>';

  const fmtDate = (s) => {
    if (!s) return '';
    return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const barWidth = (val, max) => max > 0 ? Math.round((val / max) * 100) : 0;
  const groupMax = Math.max(a.totals.push, a.totals.pull, a.totals.legs, a.totals.core, a.totals.cardio, 1);

  const weeklyChangeHtml = a.weeklyChange !== null
    ? `<span style="color:${a.weeklyChange >= 0 ? '#c6ff00' : '#ff4d6d'};font-weight:700">
        ${a.weeklyChange >= 0 ? '↑' : '↓'} ${Math.abs(a.weeklyChange)}% vs previous week
       </span>`
    : '<span style="color:#9494b8">First week tracked</span>';

  const topExHtml = a.topExercises.map(([key, val], i) =>
    `<tr>
      <td style="padding:8px 10px;color:#9494b8;font-size:12px">${i+1}</td>
      <td style="padding:8px 10px;color:#f2f2ff;font-weight:600;text-transform:capitalize">${key.replace(/-/g,' ')}</td>
      <td style="padding:8px 10px;text-align:right">
        <span style="font-family:monospace;font-weight:700;font-size:15px;color:#c6ff00">${val.toLocaleString()}</span>
        <span style="font-size:11px;color:#5a5a7a;margin-left:3px">reps</span>
      </td>
     </tr>`
  ).join('');

  const groupRows = [
    { label: '💪 Push', val: a.totals.push,   color: '#c6ff00' },
    { label: '🏋️ Pull', val: a.totals.pull,   color: '#00e5ff' },
    { label: '🦵 Legs', val: a.totals.legs,   color: '#b44dff' },
    { label: '🧘 Core', val: a.totals.core,   color: '#ffa726' },
    { label: '🔥 Cardio',val: a.totals.cardio, color: '#ff4d6d' },
  ].map(g => `
    <tr>
      <td style="padding:6px 0;color:#9494b8;font-size:13px;width:80px">${g.label}</td>
      <td style="padding:6px 10px">
        <div style="height:8px;background:#1c1c2c;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${barWidth(g.val, groupMax)}%;background:${g.color};border-radius:4px;min-width:${g.val>0?'4px':'0'}"></div>
        </div>
      </td>
      <td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:700;color:${g.color};font-size:14px">${g.val.toLocaleString()}</td>
    </tr>`
  ).join('');

  const recentLogs = [...logs].sort((a,b)=>new Date(b.log_date)-new Date(a.log_date)).slice(0,7);
  const logsHtml = recentLogs.map(log => {
    const total = Object.values(log.exercises||{}).reduce((a,b)=>a+b,0);
    const exNames = Object.entries(log.exercises||{}).slice(0,3).map(([k,v])=>
      `${k.replace(/-/g,' ')}: <b>${v}</b>`).join(' · ');
    return `<tr style="border-bottom:1px solid #1c1c2c">
      <td style="padding:10px 12px;color:#9494b8;font-size:12px;white-space:nowrap">${fmtDate(log.log_date)}</td>
      <td style="padding:10px 12px;color:#9494b8;font-size:12px">${exNames}${Object.keys(log.exercises||{}).length>3?` <span style="color:#38384a">+${Object.keys(log.exercises).length-3} more</span>`:''}</td>
      <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;color:#c6ff00">${total.toLocaleString()}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FitTrack ${periodLabel} Report</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:'Helvetica Neue',Arial,sans-serif;color:#f2f2ff">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="text-align:center;padding:32px 0 24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#5a5a7a;margin-bottom:8px">FitTrack</div>
      <div style="font-size:36px;font-weight:900;line-height:1;color:#c6ff00">YOUR ${periodLabel.toUpperCase()}</div>
      <div style="font-size:36px;font-weight:900;line-height:1;color:#f2f2ff">REPORT</div>
      <div style="font-size:14px;color:#5a5a7a;margin-top:12px">Hi ${name || 'Athlete'} 👋 — Here's your detailed workout analysis</div>
    </div>

    <!-- Grand Total Hero -->
    <div style="background:linear-gradient(135deg,rgba(198,255,0,0.1),rgba(0,229,255,0.05));border:1px solid rgba(198,255,0,0.2);border-radius:16px;padding:28px;text-align:center;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#5a5a7a;margin-bottom:6px">Total Reps This Period</div>
      <div style="font-size:64px;font-weight:900;color:#c6ff00;line-height:1;margin-bottom:8px">${a.grandTotal.toLocaleString()}</div>
      <div style="color:#9494b8;font-size:14px">${weeklyChangeHtml}</div>
    </div>

    <!-- 4 stat pills -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px">
      ${[
        { label:'Workout Days', val: a.workoutDays,    icon:'📅', color:'#c6ff00' },
        { label:'Avg Per Day',  val: a.avgPerDay+'',   icon:'📊', color:'#00e5ff' },
        { label:'Consistency',  val: a.consistency+'%',icon:'🎯', color:'#b44dff' },
        { label:'Exercises Used',val:a.allExercises.length+'',icon:'💪',color:'#ffa726'},
      ].map(s => `
        <div style="background:#0e0e18;border:1px solid #1c1c2c;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:24px;margin-bottom:4px">${s.icon}</div>
          <div style="font-family:monospace;font-size:24px;font-weight:700;color:${s.color}">${s.val}</div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#5a5a7a;margin-top:2px">${s.label}</div>
        </div>`).join('')}
    </div>

    <!-- Best Day -->
    <div style="background:#0e0e18;border:1px solid #1c1c2c;border-radius:12px;padding:20px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#5a5a7a;margin-bottom:12px">🏆 Best Single Day</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:13px;color:#9494b8">${fmtDate(a.maxDay?.date)}</div>
          <div style="font-size:12px;color:#5a5a7a;margin-top:3px">${a.maxDay?.exercises || 0} exercise types</div>
        </div>
        <div style="font-family:monospace;font-size:36px;font-weight:700;color:#c6ff00">${(a.maxDay?.total||0).toLocaleString()}</div>
      </div>
    </div>

    <!-- Muscle Group Breakdown -->
    <div style="background:#0e0e18;border:1px solid #1c1c2c;border-radius:12px;padding:20px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#5a5a7a;margin-bottom:16px">🕸️ Muscle Group Breakdown</div>
      <table style="width:100%;border-collapse:collapse">${groupRows}</table>
    </div>

    <!-- Top Exercises -->
    <div style="background:#0e0e18;border:1px solid #1c1c2c;border-radius:12px;padding:20px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#5a5a7a;margin-bottom:12px">🎖️ Top Exercises</div>
      <table style="width:100%;border-collapse:collapse">${topExHtml}</table>
    </div>

    <!-- Recent Workouts Log -->
    <div style="background:#0e0e18;border:1px solid #1c1c2c;border-radius:12px;padding:20px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#5a5a7a;margin-bottom:12px">📋 Recent Workouts</div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid #1c1c2c">
            <th style="padding:6px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#38384a;font-weight:700">Date</th>
            <th style="padding:6px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#38384a;font-weight:700">Exercises</th>
            <th style="padding:6px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#38384a;font-weight:700">Reps</th>
          </tr>
        </thead>
        <tbody>${logsHtml}</tbody>
      </table>
    </div>

    <!-- Smart Insight -->
    <div style="background:rgba(198,255,0,0.06);border:1px solid rgba(198,255,0,0.15);border-radius:12px;padding:18px;margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#5a5a7a;margin-bottom:8px">💡 Smart Insight</div>
      <div style="font-size:14px;color:#9494b8;line-height:1.6">${generateInsight(a)}</div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;padding:24px 0">
      <a href="${process.env.SITE_URL || 'https://myfittrackpro.netlify.app'}/dashboard/dashboard.html"
        style="display:inline-block;background:#c6ff00;color:#080810;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
        View Full Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0 8px;border-top:1px solid #0e0e18">
      <div style="font-size:11px;color:#38384a;line-height:1.6">
        FitTrack — Track Your Reps. Beat Your Best.<br>
        You received this because you requested a workout report.<br>
        <a href="${process.env.SITE_URL || 'https://myfittrackpro.netlify.app'}/profile/profile.html" style="color:#5a5a7a">Manage email preferences</a>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function generateInsight(a) {
  const msgs = [];
  if (a.consistency >= 80)  msgs.push(`🔥 <strong style="color:#c6ff00">${a.consistency}% consistency</strong> — You trained ${a.workoutDays} out of ${a.periodDays} days. Outstanding discipline!`);
  else if (a.consistency >= 50) msgs.push(`📈 <strong style="color:#ffa726">${a.consistency}% consistency</strong> — Good effort! Aim for 5 days a week to reach the next level.`);
  else msgs.push(`⚡ <strong style="color:#ff4d6d">${a.consistency}% consistency</strong> — You only trained ${a.workoutDays} days this period. Daily habits build champions.`);

  const { push, pull, legs, core } = a.totals;
  const total = push + pull + legs + core;
  if (total > 0) {
    const weakest = [
      { name:'pull', val:pull }, { name:'legs', val:legs },
      { name:'core', val:core }, { name:'push', val:push }
    ].sort((a,b)=>a.val-b.val)[0];
    if (weakest.val < total * 0.1)
      msgs.push(`⚠️ Your <strong style="color:#ff4d6d">${weakest.name} training</strong> is only ${Math.round((weakest.val/total)*100)}% of your volume. Balance all muscle groups for optimal results.`);
  }

  if (a.weeklyChange !== null && a.weeklyChange > 20)
    msgs.push(`📊 You did <strong style="color:#c6ff00">${a.weeklyChange}% more reps</strong> this week vs last week. Your progress curve is going up!`);

  return msgs.join('<br><br>') || 'Keep logging your workouts to receive personalized insights in your next report.';
}