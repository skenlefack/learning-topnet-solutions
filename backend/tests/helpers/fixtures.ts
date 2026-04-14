import { Pool } from 'pg';

export const IDS = {
  tenants: {
    continental: '00000000-0000-0000-0000-000000000001',
    ecowas: '00000000-0000-0000-0000-000000000010',
    eac: '00000000-0000-0000-0000-000000000011',
    sadc: '00000000-0000-0000-0000-000000000012',
    kenya: '00000000-0000-0000-0000-000000000100',
    nigeria: '00000000-0000-0000-0000-000000000101',
    southAfrica: '00000000-0000-0000-0000-000000000102',
    ethiopia: '00000000-0000-0000-0000-000000000103',
    senegal: '00000000-0000-0000-0000-000000000104',
  },
  users: {
    serge: '00000000-0000-0000-0000-000000000201',
    amina: '00000000-0000-0000-0000-000000000202',
    jean: '00000000-0000-0000-0000-000000000203',
    fatima: '00000000-0000-0000-0000-000000000204',
    kenyaAdmin: '00000000-0000-0000-0000-000000000901',
    nigeriaAdmin: '00000000-0000-0000-0000-000000000902',
    eacAdmin: '00000000-0000-0000-0000-000000000903',
    kenyaLearner: '00000000-0000-0000-0000-000000000904',
    nigeriaLearner: '00000000-0000-0000-0000-000000000905',
  },
  courses: {
    surveillance: '00000000-0000-0000-0000-000000000301',
    collecte: '00000000-0000-0000-0000-000000000302',
    analyse: '00000000-0000-0000-0000-000000000303',
    administration: '00000000-0000-0000-0000-000000000304',
    formulaires: '00000000-0000-0000-0000-000000000305',
    interoperabilite: '00000000-0000-0000-0000-000000000306',
  },
  modules: {
    introSurveillance: '00000000-0000-0000-0000-000000000401',
    maladies: '00000000-0000-0000-0000-000000000402',
    protocoles: '00000000-0000-0000-0000-000000000403',
    utilisationAris: '00000000-0000-0000-0000-000000000404',
    casPratiques: '00000000-0000-0000-0000-000000000405',
    evalIntermediaire: '00000000-0000-0000-0000-000000000406',
    projetSurveillance: '00000000-0000-0000-0000-000000000407',
    examenFinal: '00000000-0000-0000-0000-000000000408',
  },
};

/**
 * Seeds the database with test data matching seed.sql.
 * Must be called after init.sql has been executed.
 */
export async function seedTestData(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO academy_core, public');

    // Tenants
    await client.query(
      `INSERT INTO tenants (id, name, code, level, parent_id) VALUES
        ($1, 'AU-IBAR Continental', 'AU-IBAR', 'continental', NULL),
        ($2, 'ECOWAS', 'ECOWAS', 'rec', $1),
        ($3, 'EAC', 'EAC', 'rec', $1),
        ($4, 'SADC', 'SADC', 'rec', $1),
        ($5, 'Kenya', 'KE', 'country', $3),
        ($6, 'Nigeria', 'NG', 'country', $2),
        ($7, 'South Africa', 'ZA', 'country', $4),
        ($8, 'Ethiopia', 'ET', 'country', $3),
        ($9, 'Senegal', 'SN', 'country', $2)
      ON CONFLICT DO NOTHING`,
      [
        IDS.tenants.continental,
        IDS.tenants.ecowas,
        IDS.tenants.eac,
        IDS.tenants.sadc,
        IDS.tenants.kenya,
        IDS.tenants.nigeria,
        IDS.tenants.southAfrica,
        IDS.tenants.ethiopia,
        IDS.tenants.senegal,
      ],
    );

    // Users (seed + test-specific)
    await client.query(
      `INSERT INTO users (id, email, first_name, last_name, role, tenant_id, preferred_language) VALUES
        ($1, 'serge@au-ibar.org', 'Serge', 'Admin', 'admin_continental', $5, 'fr'),
        ($2, 'amina.osei@au-ibar.org', 'Amina', 'Osei', 'trainer', $5, 'en'),
        ($3, 'jean.baptiste@eac.int', 'Jean-Baptiste', 'Nkurunziza', 'trainer', $6, 'fr'),
        ($4, 'fatima.diallo@ecowas.int', 'Fatima', 'Diallo', 'trainer', $7, 'fr'),
        ($8, 'admin@kenya.go.ke', 'Kenya', 'Admin', 'admin_country', $9, 'en'),
        ($10, 'admin@nigeria.gov.ng', 'Nigeria', 'Admin', 'admin_country', $11, 'en'),
        ($12, 'admin@eac.int', 'EAC', 'Admin', 'admin_rec', $6, 'en'),
        ($13, 'learner@kenya.go.ke', 'Learner', 'Kenya', 'learner', $9, 'en'),
        ($14, 'learner@nigeria.gov.ng', 'Learner', 'Nigeria', 'learner', $11, 'en')
      ON CONFLICT DO NOTHING`,
      [
        IDS.users.serge,       // $1
        IDS.users.amina,       // $2
        IDS.users.jean,        // $3
        IDS.users.fatima,      // $4
        IDS.tenants.continental, // $5
        IDS.tenants.eac,       // $6
        IDS.tenants.ecowas,    // $7
        IDS.users.kenyaAdmin,  // $8
        IDS.tenants.kenya,     // $9
        IDS.users.nigeriaAdmin, // $10
        IDS.tenants.nigeria,   // $11
        IDS.users.eacAdmin,    // $12
        IDS.users.kenyaLearner, // $13
        IDS.users.nigeriaLearner, // $14
      ],
    );

    // Courses
    await client.query(
      `INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, published_at) VALUES
        ($1, $7, 'continental', '{"fr":"Surveillance épidémiologique","en":"Epidemiological Surveillance"}', '{"fr":"Maîtrisez la surveillance"}', 'surveillance-epidemiologique', 'beginner', 'published', 12, 70, NOW()),
        ($2, $7, 'continental', '{"fr":"Collecte de données terrain","en":"Field Data Collection"}', '{"fr":"Apprenez à utiliser ARIS"}', 'collecte-donnees-terrain', 'intermediate', 'published', 24, 75, NOW()),
        ($3, $7, 'continental', '{"fr":"Analyse & Rapports ARIS","en":"ARIS Analysis & Reports"}', '{"fr":"Créez des tableaux de bord"}', 'analyse-rapports', 'advanced', 'published', 36, 80, NOW()),
        ($4, $7, 'continental', '{"fr":"Administration système ARIS","en":"ARIS System Administration"}', '{"fr":"Devenez expert"}', 'administration-systeme', 'expert', 'published', 48, 85, NOW()),
        ($5, $7, 'continental', '{"fr":"Gestion des formulaires","en":"Form Management"}', '{"fr":"FormBuilder ARIS"}', 'gestion-formulaires', 'intermediate', 'published', 18, 75, NOW()),
        ($6, $7, 'continental', '{"fr":"Interopérabilité DHIS2/FHIR","en":"DHIS2/FHIR Interoperability"}', '{"fr":"Échanges de données"}', 'interoperabilite-dhis2-fhir', 'advanced', 'published', 32, 80, NOW())
      ON CONFLICT DO NOTHING`,
      [
        IDS.courses.surveillance,     // $1
        IDS.courses.collecte,         // $2
        IDS.courses.analyse,          // $3
        IDS.courses.administration,   // $4
        IDS.courses.formulaires,      // $5
        IDS.courses.interoperabilite, // $6
        IDS.tenants.continental,      // $7
      ],
    );

    // Modules for surveillance course
    await client.query(
      `INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes, is_required) VALUES
        ($1, $9, '{"fr":"Introduction à la surveillance","en":"Introduction to Surveillance"}', 1, 45, true),
        ($2, $9, '{"fr":"Types de maladies animales","en":"Types of Animal Diseases"}', 2, 60, true),
        ($3, $9, '{"fr":"Protocoles de déclaration","en":"Reporting Protocols"}', 3, 90, true),
        ($4, $9, '{"fr":"Utilisation ARIS surveillance","en":"Using ARIS for Surveillance"}', 4, 120, true),
        ($5, $9, '{"fr":"Cas pratiques terrain","en":"Field Case Studies"}', 5, 90, true),
        ($6, $9, '{"fr":"Évaluation intermédiaire","en":"Mid-term Assessment"}', 6, 45, true),
        ($7, $9, '{"fr":"Projet de surveillance","en":"Surveillance Project"}', 7, 120, true),
        ($8, $9, '{"fr":"Examen final","en":"Final Exam"}', 8, 60, true)
      ON CONFLICT DO NOTHING`,
      [
        IDS.modules.introSurveillance,  // $1
        IDS.modules.maladies,           // $2
        IDS.modules.protocoles,         // $3
        IDS.modules.utilisationAris,    // $4
        IDS.modules.casPratiques,       // $5
        IDS.modules.evalIntermediaire,  // $6
        IDS.modules.projetSurveillance, // $7
        IDS.modules.examenFinal,        // $8
        IDS.courses.surveillance,       // $9
      ],
    );
  } finally {
    client.release();
  }
}

/**
 * Cleans all data from the database (keeps schema).
 */
export async function cleanTestData(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO academy_core, public');
    await client.query(
      'TRUNCATE audit_log, live_attendance, live_sessions, certifications, assessment_attempts, questions, assessments, progress_tracking, enrollments, lessons, modules, course_overrides, courses, users, tenants CASCADE',
    );
  } finally {
    client.release();
  }
}
