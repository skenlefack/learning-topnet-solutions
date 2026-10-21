// Generate SQL to import TopNet Skills questions into PostgreSQL
// Uses $json$...$json$ dollar-quoting to avoid escaping issues
// Usage: node generate-skills-sql.js [questions.json path] > skills-import.sql
const fs = require('fs');
const path = require('path');

const QUESTIONS_PATH = process.argv[2] || path.resolve(__dirname, 'questions.json');
const TID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

const data = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));

// Dollar-quoted JSON — safe for any content
function jq(obj) {
  return `$j$${JSON.stringify(obj)}$j$::jsonb`;
}

function sq(s) {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

const out = [];
out.push('SET search_path TO academy_core, public;');

// No global transaction — each INSERT independent (avoids cascade failure)

// Formats
const formats = [
  { code: 'complet', fr: 'Test complet', n: 100, sec: 14400, free: false, app: '{track}', sort: 1 },
  { code: 'express', fr: 'Test express', n: 40, sec: 5400, free: true, app: '{track}', sort: 2 },
  { code: 'certif', fr: 'Examen blanc', n: 0, sec: 0, free: false, app: '{cert}', sort: 3 },
  { code: 'decouverte', fr: 'Examen decouverte', n: 20, sec: 0, free: true, app: '{cert}', sort: 4 },
];
for (const f of formats) {
  out.push(`INSERT INTO skill_test_formats (tenant_id, code, label, question_count, duration_sec, is_free, applicable_to, sort_order) VALUES ('${TID}', '${f.code}', ${jq({fr: f.fr})}, ${f.n}, ${f.sec}, ${f.free}, '${f.app}', ${f.sort}) ON CONFLICT (tenant_id, code) DO NOTHING;`);
}

// Tracks + Questions
let totalQ = 0;
data.tracks.forEach((t, idx) => {
  const kind = t.kind || 'track';

  out.push(`INSERT INTO skill_tracks (tenant_id, code, kind, name, short_name, description, role_description, vendor, family, exam_code, exam_duration_sec, domains, weights, sort_order) VALUES ('${TID}', '${t.code}', '${kind}', ${jq({fr: t.name})}, ${jq({fr: t.short || t.name})}, ${jq({fr: t.desc || ''})}, ${jq({fr: t.role || ''})}, ${sq(t.vendor || null)}, ${sq(t.family || null)}, ${sq(t.examCode || null)}, ${t.examSec || 'NULL'}, ${jq(t.domains)}, ${jq(t.weights || {})}, ${idx}) ON CONFLICT (tenant_id, code) DO NOTHING;`);

  for (const q of t.questions) {
    const options = q.o.map((text, i) => ({
      text: { fr: text },
      is_correct: i === q.a,
    }));
    const diff = q.l === 1 ? 1 : q.l === 2 ? 3 : 5;
    const explanation = q.e ? jq({fr: q.e}) : 'NULL';

    out.push(`INSERT INTO questions (skill_track_id, original_id, domain, question_text, question_type, options, correct_answer, difficulty, points, tags, explanation) VALUES ((SELECT id FROM skill_tracks WHERE code = '${t.code}' AND tenant_id = '${TID}'), '${q.id}', '${q.d}', ${jq({fr: q.q})}, 'single_choice', ${jq(options)}, ${jq({index: q.a})}, ${diff}, ${q.l}, '{${t.code},${q.d},${kind}}', ${explanation});`);
    totalQ++;
  }
});

// Offers
const offers = [
  { code: 'TEST-EXPRESS', kind: 'credits', name: 'Test Express', tag: '1 test rapide', price: 0, credits: 1, days: 0, features: ['40 questions', '1h30', 'Resultat immediat'], hl: false },
  { code: 'TEST-COMPLET', kind: 'credits', name: 'Test Complet', tag: '1 test approfondi', price: 3000, credits: 1, days: 0, features: ['100 questions', '4 heures', 'Bilan detaille', 'Attestation verifiable'], hl: false },
  { code: 'PACK-3', kind: 'credits', name: 'Pack 3 Tests', tag: '3 credits de test', price: 7500, credits: 3, days: 0, features: ['3 tests au choix', 'Bilans detailles', 'Attestations verifiables'], hl: false },
  { code: 'PACK-5', kind: 'credits', name: 'Pack 5 Tests', tag: '5+1 credits', price: 12000, credits: 6, days: 0, features: ['5+1 tests', 'Bilans detailles', '1 test offert'], hl: true },
  { code: 'PASS-30', kind: 'unlimited_pass', name: 'Pass 30 jours', tag: 'Tests illimites pendant 30 jours', price: 15000, credits: 0, days: 30, features: ['Tests illimites', 'Tous les parcours', 'Tous les examens blancs'], hl: false },
  { code: 'PASS-90', kind: 'unlimited_pass', name: 'Pass 90 jours', tag: 'Tests illimites pendant 3 mois', price: 35000, credits: 0, days: 90, features: ['Tests illimites', 'Tous les parcours', 'Meilleur rapport qualite-prix'], hl: true },
];
offers.forEach((o, i) => {
  out.push(`INSERT INTO offers (tenant_id, code, kind, name, tagline, price, currency, credits, days, features, is_highlighted, is_active, sort_order) VALUES ('${TID}', '${o.code}', '${o.kind}', ${jq({fr: o.name})}, ${jq({fr: o.tag})}, ${o.price}, 'XAF', ${o.credits}, ${o.days}, ${jq(o.features)}, ${o.hl}, true, ${i}) ON CONFLICT (tenant_id, code) DO NOTHING;`);
});

process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`Generated ${totalQ} questions for ${data.tracks.length} tracks, ${offers.length} offers\n`);
