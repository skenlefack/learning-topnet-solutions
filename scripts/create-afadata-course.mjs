#!/usr/bin/env node
// ============================================================================
// AU-IBAR Learning — Create AFAData Course from Word Document
// Extracts HTML content, translates via SYSTRAN (fr→en, en→ar, en→pt), creates via API
// ============================================================================
import { readFileSync } from 'fs';
import { resolve } from 'path';

const API_URL = 'http://10.202.101.144';
const SYSTRAN_URL = 'https://systran.au-ibar.org:8904';
const SYSTRAN_KEY = 'ea850eeb-4bf3-45d5-81b3-d0afe1bb172d';
const CATEGORY_ID = 'be91be45-be06-4b3d-80fc-0ce6a498137b';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
async function login() {
  const res = await fetch(`${API_URL}/api/learning/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'serge@au-ibar.org', password: 'academy2026' }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed');
  console.log('OK Logged in');
  return data.token;
}

// ---------------------------------------------------------------------------
// SYSTRAN Translation (supported: fr↔en, en↔ar, en↔pt)
// For fr→ar and fr→pt: pivot through English
// ---------------------------------------------------------------------------
async function systranTranslate(text, source, target) {
  if (!text?.trim() || source === target) return text;
  try {
    const res = await fetch(`${SYSTRAN_URL}/translation/text/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${SYSTRAN_KEY}`,
      },
      body: JSON.stringify({ input: [{ text }], source, target }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const raw = data.outputs?.[0]?.output || '';
    // SYSTRAN wraps output as JSON string '{"text":"Hello"}' — unwrap
    if (typeof raw === 'string' && raw.startsWith('{')) {
      try { return JSON.parse(raw).text || raw; } catch { return raw; }
    }
    return raw;
  } catch {
    return '';
  }
}

async function translateMultiLang(frText) {
  if (!frText?.trim()) return { fr: '' };
  const shortLabel = frText.slice(0, 50);
  process.stdout.write(`  [SYSTRAN] "${shortLabel}..." `);

  // Step 1: fr → en
  const en = await systranTranslate(frText, 'fr', 'en');

  // Step 2: en → ar, en → pt (in parallel, using English as pivot)
  const [ar, pt] = await Promise.all([
    en ? systranTranslate(en, 'en', 'ar') : Promise.resolve(''),
    en ? systranTranslate(en, 'en', 'pt') : Promise.resolve(''),
  ]);

  const ok = [en && 'EN', ar && 'AR', pt && 'PT'].filter(Boolean).join(',');
  console.log(ok || 'FAILED');

  return { fr: frText, ...(en && { en }), ...(ar && { ar }), ...(pt && { pt }) };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function apiPost(token, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    console.error(`  FAIL POST ${path}:`, JSON.stringify(data).slice(0, 300));
    throw new Error(`API error ${res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Parse HTML into chapter sections
// ---------------------------------------------------------------------------
function parseHTMLSections(html) {
  // Match major chapter headings: lines that start exactly with "N. Title"
  // in the mammoth output these appear as headings or bold paragraphs
  const sections = [];

  // Strategy: find all positions of chapter-level headings
  // Look for patterns like ">1. Introduction" or ">14. Qualité"
  const patterns = [];

  // Search for heading-like patterns
  const regex = />(\d{1,2})\.\s+([A-ZÀ-ÿ][^<]{3,})/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const num = parseInt(m[1]);
    const title = m[2].trim();
    // Only accept chapter-level headings (1-16) and filter out TOC entries (which contain tab chars)
    if (num >= 1 && num <= 16 && !title.includes('\t') && title.length > 5 && title.length < 150) {
      // Avoid duplicates - check if this num is already captured
      if (!patterns.find(p => p.num === num && p.title === title)) {
        patterns.push({ num, title, index: m.index });
      }
    }
  }

  // Deduplicate: keep only first occurrence of each chapter number
  // but skip the TOC occurrences (before the actual content)
  const seen = new Map();
  for (const p of patterns) {
    // The actual content chapters appear after the TOC
    // TOC entries typically appear early; content chapters appear later
    if (!seen.has(p.num)) {
      seen.set(p.num, []);
    }
    seen.get(p.num).push(p);
  }

  // For each chapter, take the LAST occurrence (actual content, not TOC)
  const chapters = [];
  for (const [num, occurrences] of seen) {
    if (occurrences.length >= 1) {
      // Take the last one (content section, not TOC)
      chapters.push(occurrences[occurrences.length - 1]);
    }
  }

  // Sort by index position in the HTML
  chapters.sort((a, b) => a.index - b.index);

  // Extract HTML between chapter boundaries
  for (let i = 0; i < chapters.length; i++) {
    const startIdx = chapters[i].index - 50; // Include the tag before
    const endIdx = i + 1 < chapters.length ? chapters[i + 1].index - 50 : html.length;

    // Find the actual tag start
    const tagStart = html.lastIndexOf('<', chapters[i].index);
    const end = i + 1 < chapters.length ? html.lastIndexOf('<', chapters[i + 1].index) : html.length;

    sections.push({
      num: chapters[i].num,
      title: chapters[i].title,
      html: html.slice(tagStart >= 0 ? tagStart : startIdx, end >= 0 ? end : endIdx),
    });
  }

  return sections;
}

function splitSectionIntoLessons(sectionHtml, chapterNum) {
  // Find sub-sections like "3.1 Vue d'ensemble", "3.2 Champs du formulaire"
  const regex = new RegExp(`>(${chapterNum}\\.(\\d+))\\s+([A-ZÀ-ÿ'][^<]{2,})`, 'g');
  const subs = [];
  let m;
  while ((m = regex.exec(sectionHtml)) !== null) {
    const title = m[3].trim();
    if (!title.includes('\t') && title.length < 150) {
      subs.push({ ref: m[1], subNum: parseInt(m[2]), title, index: m.index });
    }
  }

  // Deduplicate (keep last occurrence of each sub-number)
  const deduped = new Map();
  for (const s of subs) {
    deduped.set(s.subNum, s);
  }
  const uniqueSubs = [...deduped.values()].sort((a, b) => a.index - b.index);

  if (uniqueSubs.length === 0) {
    return [{ title: `Introduction`, html: sectionHtml }];
  }

  const lessons = [];
  for (let i = 0; i < uniqueSubs.length; i++) {
    const tagStart = sectionHtml.lastIndexOf('<', uniqueSubs[i].index);
    const end = i + 1 < uniqueSubs.length
      ? sectionHtml.lastIndexOf('<', uniqueSubs[i + 1].index)
      : sectionHtml.length;

    lessons.push({
      title: uniqueSubs[i].title,
      html: sectionHtml.slice(tagStart >= 0 ? tagStart : uniqueSubs[i].index, end >= 0 ? end : sectionHtml.length),
    });
  }

  // Group if too many lessons (max 5 per module)
  if (lessons.length > 5) {
    const grouped = [];
    const groupSize = Math.ceil(lessons.length / 4);
    for (let g = 0; g < lessons.length; g += groupSize) {
      const group = lessons.slice(g, g + groupSize);
      grouped.push({
        title: group.length === 1 ? group[0].title : `${group[0].title} — ${group[group.length - 1].title}`,
        html: group.map(l => l.html).join('\n'),
      });
    }
    return grouped;
  }

  return lessons;
}

// ---------------------------------------------------------------------------
// Module definitions
// ---------------------------------------------------------------------------
const MODULES = [
  { num: 1,  fr: "Introduction à ARIS et AFAData", minutes: 45 },
  { num: 2,  fr: "Prise en main de l'interface", minutes: 40 },
  { num: 3,  fr: "Formulaire Captures de pêche", minutes: 60 },
  { num: 4,  fr: "Formulaire Registre des navires", minutes: 45 },
  { num: 5,  fr: "Formulaire Fermes aquacoles", minutes: 45 },
  { num: 6,  fr: "Formulaire Production aquacole", minutes: 50 },
  { num: 7,  fr: "Formulaire Efforts de pêche", minutes: 45 },
  { num: 8,  fr: "Formulaire Commerce de poisson", minutes: 50 },
  { num: 9,  fr: "Flux de validation à 4 niveaux", minutes: 60 },
  { num: 10, fr: "Campagnes de collecte", minutes: 40 },
  { num: 11, fr: "Importation et exportation de données", minutes: 50 },
  { num: 12, fr: "Tableaux de bord et analyses", minutes: 50 },
  { num: 13, fr: "Référentiels et données de référence", minutes: 40 },
  { num: 14, fr: "Qualité des données et bonnes pratiques", minutes: 60 },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Creating AFAData Course ===\n');

  const token = await login();

  // Read mammoth HTML
  const htmlPath = resolve(process.env.TEMP || '/tmp', 'Guide_Formation_AFAData_ARIS.html');
  const html = readFileSync(htmlPath, 'utf-8');

  const sections = parseHTMLSections(html);
  console.log(`Parsed ${sections.length} chapters:`, sections.map(s => `${s.num}. ${s.title.slice(0, 40)}`).join(' | '));

  // Read thumbnail as base64
  const imgPath = resolve('docs/Guide_Formation_AFAData_ARIS.jpg');
  const imgData = readFileSync(imgPath);
  const thumbnailBase64 = `data:image/jpeg;base64,${imgData.toString('base64')}`;

  // ----- Translate course title & description -----
  console.log('\n--- Translating course metadata ---');
  const courseTitle = await translateMultiLang('Guide complet de formation AFADATA');
  const courseDesc = await translateMultiLang(
    "Collecte, validation et analyse des données halieutiques pour les États Membres de l'Union Africaine"
  );

  // ----- Create course (without thumbnail first, then update) -----
  console.log('\n--- Creating course ---');
  const courseRes = await apiPost(token, '/api/courses', {
    title: courseTitle,
    description: courseDesc,
    descriptionHtml: `<h2>Guide complet de formation AFADATA</h2>
<p><em>Collecte, validation et analyse des données halieutiques pour les États Membres de l'Union Africaine</em></p>
<h3>Objectifs de la formation</h3>
<ul>
<li>Comprendre l'architecture d'ARIS et le module AFAData</li>
<li>Maîtriser les 6 formulaires de collecte de données halieutiques</li>
<li>Appliquer le flux de validation à 4 niveaux</li>
<li>Gérer les campagnes de collecte et l'importation/exportation de données</li>
<li>Utiliser les tableaux de bord et analyses</li>
<li>Garantir la qualité des données saisies</li>
</ul>
<h3>Informations</h3>
<table>
<tr><td><strong>Durée estimée</strong></td><td>12 heures (14 modules)</td></tr>
<tr><td><strong>Public cible</strong></td><td>Tous les utilisateurs ARIS</td></tr>
<tr><td><strong>Prérequis</strong></td><td>Aucun</td></tr>
<tr><td><strong>Version</strong></td><td>1.0 – Juin 2026</td></tr>
</table>`,
    slug: 'guide-formation-afadata',
    level: 'beginner',
    categoryId: CATEGORY_ID,
    status: 'published',
    estimatedHours: 12,
    passingScore: 70,
    tags: ['afadata', 'peche', 'aquaculture', 'aris', 'fao', 'halieutique'],
    thumbnailUrl: thumbnailBase64,
  });

  const courseId = courseRes.data?.id;
  console.log(`OK Course created: ${courseId}\n`);

  // ----- Create modules & lessons -----
  for (let mi = 0; mi < MODULES.length; mi++) {
    const mod = MODULES[mi];
    console.log(`\n=== Module ${mod.num}/${MODULES.length}: ${mod.fr} ===`);

    const moduleTitle = await translateMultiLang(mod.fr);

    const modRes = await apiPost(token, '/api/courses/modules', {
      courseId,
      title: moduleTitle,
      sortOrder: mi,
      estimatedMinutes: mod.minutes,
      isRequired: true,
    });
    const moduleId = modRes.data?.id;
    console.log(`  OK Module: ${moduleId}`);

    // Find section(s) for this module
    let lessonData;

    if (mod.num === 14) {
      // Combine chapters 14, 15, 16 into module 14
      const ch14 = sections.find(s => s.num === 14);
      const ch15 = sections.find(s => s.num === 15);
      const ch16 = sections.find(s => s.num === 16);
      lessonData = [];
      if (ch14) lessonData.push({ fr: 'Règles de validation et erreurs courantes', html: ch14.html });
      if (ch15) lessonData.push({ fr: 'Bonnes pratiques de saisie', html: ch15.html });
      if (ch16) lessonData.push({ fr: 'Résolution des problèmes et support', html: ch16.html });
      if (lessonData.length === 0) {
        lessonData.push({ fr: mod.fr, html: `<p>${mod.fr}</p>` });
      }
    } else {
      const section = sections.find(s => s.num === mod.num);
      if (section) {
        lessonData = splitSectionIntoLessons(section.html, mod.num);
      } else {
        console.log(`  WARN: No section found for chapter ${mod.num}`);
        lessonData = [{ fr: mod.fr, html: `<p>${mod.fr}</p>` }];
      }
    }

    // Create each lesson
    for (let li = 0; li < lessonData.length; li++) {
      const lesson = lessonData[li];
      const titleFr = lesson.fr || lesson.title || `Leçon ${li + 1}`;
      const shortTitle = titleFr.length > 150 ? titleFr.slice(0, 147) + '...' : titleFr;

      console.log(`  Lesson ${li + 1}/${lessonData.length}: ${shortTitle.slice(0, 60)}`);
      const lessonTitle = await translateMultiLang(shortTitle);

      // Clean HTML
      const cleanHtml = (lesson.html || '')
        .replace(/<img[^>]*>/g, '')
        .replace(/\x00/g, '');

      try {
        const lRes = await apiPost(token, '/api/courses/lessons', {
          moduleId,
          title: lessonTitle,
          type: 'text',
          content: { body: cleanHtml },
          sortOrder: li,
          isRequired: true,
          durationMinutes: Math.round(mod.minutes / lessonData.length),
        });
        console.log(`    OK Lesson: ${lRes.data?.id}`);
      } catch (err) {
        console.error(`    FAIL: ${err.message}`);
      }

      // Small delay to not overwhelm SYSTRAN
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n========================================');
  console.log(`DONE! Course ID: ${courseId}`);
  console.log(`URL: ${API_URL}/courses/${courseId}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
