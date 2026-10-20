#!/usr/bin/env tsx
// ============================================================================
// Migration script: TopNet Skills questions.json → LMS Academy PostgreSQL
//
// Imports: 43 skill tracks, 2940+ questions, 4 test formats, 12 offers
// Run once: npx tsx scripts/migrate-skills-content.ts
// Requires: DATABASE_URL environment variable
// ============================================================================
import { readFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://academy:academy_secret_2026@localhost:5432/academy';
const QUESTIONS_PATH = resolve(__dirname, '../../../topnet-skills/data/questions.json');

// Default tenant ID — set to your continental tenant UUID
const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

interface SkillQuestion {
  id: string;
  d: string;    // domain code
  l: number;    // difficulty level 1-3
  q: string;    // question text
  o: string[];  // options
  a: number;    // correct answer index (0-3)
  e?: string;   // explanation
  c?: string;   // content type
}

interface SkillTrack {
  code: string;
  name: string;
  short?: string;
  kind?: 'track' | 'cert';
  role?: string;
  desc?: string;
  vendor?: string;
  family?: string;
  examCode?: string;
  exam?: Record<string, string>;
  examSec?: number;
  domains: Record<string, string>;
  weights?: Record<string, number>;
  curriculum?: any;
  questions: SkillQuestion[];
}

async function main() {
  console.log('Reading questions.json...');
  const raw = readFileSync(QUESTIONS_PATH, 'utf8');
  const data = JSON.parse(raw) as { tracks: SkillTrack[] };
  console.log(`Found ${data.tracks.length} tracks`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SET search_path TO academy_core, public");

    // Check if tenant exists
    const { rows: [tenant] } = await client.query(
      'SELECT id FROM tenants WHERE id = $1',
      [TENANT_ID],
    );
    if (!tenant) {
      console.log(`Tenant ${TENANT_ID} not found. Creating default continental tenant...`);
      await client.query(
        `INSERT INTO tenants (id, name, code, level) VALUES ($1, 'TopNet Solutions', 'TN', 'continental')
         ON CONFLICT (id) DO NOTHING`,
        [TENANT_ID],
      );
    }

    // ======================================================================
    // 1. INSERT TEST FORMATS
    // ======================================================================
    console.log('Inserting test formats...');
    const formats = [
      { code: 'complet', label: { fr: 'Test complet', en: 'Full test' }, n: 100, sec: 14400, free: false, applicable: '{track}', sort: 1 },
      { code: 'express', label: { fr: 'Test express', en: 'Express test' }, n: 40, sec: 5400, free: true, applicable: '{track}', sort: 2 },
      { code: 'certif', label: { fr: 'Examen blanc', en: 'Practice exam' }, n: 0, sec: 0, free: false, applicable: '{cert}', sort: 3 },
      { code: 'decouverte', label: { fr: 'Examen découverte', en: 'Discovery exam' }, n: 20, sec: 0, free: true, applicable: '{cert}', sort: 4 },
    ];

    for (const f of formats) {
      await client.query(
        `INSERT INTO skill_test_formats (tenant_id, code, label, question_count, duration_sec, is_free, applicable_to, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tenant_id, code) DO UPDATE SET label = $3, question_count = $4, duration_sec = $5`,
        [TENANT_ID, f.code, JSON.stringify(f.label), f.n, f.sec, f.free, f.applicable, f.sort],
      );
    }
    console.log(`  ${formats.length} formats inserted`);

    // ======================================================================
    // 2. INSERT SKILL TRACKS + QUESTIONS
    // ======================================================================
    let totalQuestions = 0;

    for (const track of data.tracks) {
      const kind = track.kind || 'track';
      console.log(`Processing ${track.code} (${kind}) — ${track.questions.length} questions...`);

      // Insert skill track
      const { rows: [st] } = await client.query(
        `INSERT INTO skill_tracks
           (tenant_id, code, kind, name, short_name, description, role_description,
            vendor, family, exam_code, exam_info, exam_duration_sec,
            domains, weights, curriculum, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (tenant_id, code) DO UPDATE
           SET name = $4, domains = $13, weights = $14, curriculum = $15
         RETURNING id`,
        [
          TENANT_ID,
          track.code,
          kind,
          JSON.stringify({ fr: track.name }),
          JSON.stringify({ fr: track.short || track.name }),
          JSON.stringify({ fr: track.desc || '' }),
          JSON.stringify({ fr: track.role || '' }),
          track.vendor || null,
          track.family || null,
          track.examCode || null,
          JSON.stringify(track.exam || {}),
          track.examSec || null,
          JSON.stringify(track.domains),
          JSON.stringify(track.weights || {}),
          JSON.stringify(track.curriculum || {}),
          data.tracks.indexOf(track),
        ],
      );

      const trackId = st.id;

      // Insert questions (batch for performance)
      for (const q of track.questions) {
        // Map difficulty: Skills l=1,2,3 → LMS 1-5 scale (1→1, 2→3, 3→5)
        const difficulty = q.l === 1 ? 1 : q.l === 2 ? 3 : 5;
        const points = q.l; // points = difficulty weight

        // Build options in LMS format
        const options = q.o.map((text, idx) => ({
          text: { fr: text },
          is_correct: idx === q.a,
        }));

        await client.query(
          `INSERT INTO questions
             (skill_track_id, original_id, domain, question_text, question_type,
              options, correct_answer, difficulty, points, tags, explanation)
           VALUES ($1, $2, $3, $4, 'single_choice', $5, $6, $7, $8, $9, $10)
           ON CONFLICT DO NOTHING`,
          [
            trackId,
            q.id,
            q.d,
            JSON.stringify({ fr: q.q }),
            JSON.stringify(options),
            JSON.stringify({ index: q.a }),
            difficulty,
            points,
            [track.code, q.d, kind],
            q.e ? JSON.stringify({ fr: q.e }) : null,
          ],
        );
        totalQuestions++;
      }
    }

    console.log(`\nTotal: ${data.tracks.length} tracks, ${totalQuestions} questions inserted`);

    // ======================================================================
    // 3. INSERT DEFAULT OFFERS
    // ======================================================================
    console.log('\nInserting default offers...');
    const offers = [
      { code: 'TEST-EXPRESS', kind: 'credits', name: 'Test Express', tagline: '1 test rapide (40 questions)', price: 0, credits: 1, features: ['40 questions', '1h30', 'Résultat immédiat'] },
      { code: 'TEST-COMPLET', kind: 'credits', name: 'Test Complet', tagline: '1 test approfondi (100 questions)', price: 3000, credits: 1, features: ['100 questions', '4 heures', 'Bilan détaillé par domaine', 'Attestation vérifiable'] },
      { code: 'PACK-3', kind: 'credits', name: 'Pack 3 Tests', tagline: '3 crédits de test', price: 7500, credits: 3, features: ['3 tests au choix', 'Bilans détaillés', 'Attestations vérifiables'] },
      { code: 'PACK-5', kind: 'credits', name: 'Pack 5 Tests', tagline: '5 crédits de test + 1 offert', price: 12000, credits: 6, features: ['5+1 tests', 'Bilans détaillés', 'Attestations vérifiables', '1 test offert'], highlight: true },
      { code: 'PASS-30', kind: 'unlimited_pass', name: 'Pass 30 jours', tagline: 'Tests illimités pendant 30 jours', price: 15000, days: 30, features: ['Tests illimités', 'Tous les parcours', 'Tous les examens blancs', 'Bilans détaillés'] },
      { code: 'PASS-90', kind: 'unlimited_pass', name: 'Pass 90 jours', tagline: 'Tests illimités pendant 3 mois', price: 35000, days: 90, features: ['Tests illimités', 'Tous les parcours', 'Tous les examens blancs', 'Bilans détaillés', 'Meilleur rapport qualité-prix'], highlight: true },
    ];

    for (let i = 0; i < offers.length; i++) {
      const o = offers[i];
      await client.query(
        `INSERT INTO offers
           (tenant_id, code, kind, name, tagline, price, currency, credits, days,
            features, is_highlighted, is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,'XAF',$7,$8,$9,$10,true,$11)
         ON CONFLICT (tenant_id, code) DO UPDATE
           SET name = $4, price = $6, features = $9`,
        [
          TENANT_ID, o.code, o.kind,
          JSON.stringify({ fr: o.name }),
          JSON.stringify({ fr: o.tagline }),
          o.price,
          o.credits || 0,
          o.days || 0,
          JSON.stringify(o.features),
          (o as any).highlight || false,
          i,
        ],
      );
    }
    console.log(`  ${offers.length} offers inserted`);

    await client.query('COMMIT');
    console.log('\n✅ Migration complete!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
