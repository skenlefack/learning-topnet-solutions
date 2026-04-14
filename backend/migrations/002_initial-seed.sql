-- ============================================================================
-- Migration 002: Initial Seed Data (development only)
-- Skip this migration in production by not running it, or run with --fake
-- ============================================================================
SET search_path TO academy_core, public;

-- Tenants hierarchy
INSERT INTO tenants (id, name, code, level, parent_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'AU-IBAR Continental', 'AU-IBAR', 'continental', NULL),
  ('00000000-0000-0000-0000-000000000010', 'ECOWAS', 'ECOWAS', 'rec', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000011', 'EAC', 'EAC', 'rec', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000012', 'SADC', 'SADC', 'rec', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000100', 'Kenya', 'KE', 'country', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000101', 'Nigeria', 'NG', 'country', '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000102', 'South Africa', 'ZA', 'country', '00000000-0000-0000-0000-000000000012'),
  ('00000000-0000-0000-0000-000000000103', 'Ethiopia', 'ET', 'country', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000104', 'Senegal', 'SN', 'country', '00000000-0000-0000-0000-000000000010')
ON CONFLICT (code) DO NOTHING;

-- Demo users
INSERT INTO users (id, email, first_name, last_name, role, tenant_id, preferred_language) VALUES
  ('00000000-0000-0000-0000-000000000201', 'serge@au-ibar.org', 'Serge', 'Admin', 'admin_continental', '00000000-0000-0000-0000-000000000001', 'fr'),
  ('00000000-0000-0000-0000-000000000202', 'amina.osei@au-ibar.org', 'Amina', 'Osei', 'trainer', '00000000-0000-0000-0000-000000000001', 'en'),
  ('00000000-0000-0000-0000-000000000203', 'jean.baptiste@eac.int', 'Jean-Baptiste', 'Nkurunziza', 'trainer', '00000000-0000-0000-0000-000000000011', 'fr'),
  ('00000000-0000-0000-0000-000000000204', 'fatima.diallo@ecowas.int', 'Fatima', 'Diallo', 'trainer', '00000000-0000-0000-0000-000000000010', 'fr')
ON CONFLICT (email) DO NOTHING;

-- Demo courses
INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, published_at) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'continental',
    '{"fr":"Surveillance épidémiologique","en":"Epidemiological Surveillance","ar":"المراقبة الوبائية","pt":"Vigilância Epidemiológica"}',
    '{"fr":"Maîtrisez les fondamentaux de la surveillance épidémiologique animale avec ARIS"}',
    'surveillance-epidemiologique', 'beginner', 'published', 12, 70, NOW()),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'continental',
    '{"fr":"Collecte de données terrain","en":"Field Data Collection","ar":"جمع البيانات الميدانية","pt":"Coleta de Dados de Campo"}',
    '{"fr":"Apprenez à utiliser ARIS pour la collecte terrain, y compris le mode offline"}',
    'collecte-donnees-terrain', 'intermediate', 'published', 24, 75, NOW()),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', 'continental',
    '{"fr":"Analyse & Rapports ARIS","en":"ARIS Analysis & Reports","ar":"تحليل وتقارير ARIS","pt":"Análise e Relatórios ARIS"}',
    '{"fr":"Créez des tableaux de bord et rapports avancés avec les outils analytiques ARIS"}',
    'analyse-rapports', 'advanced', 'published', 36, 80, NOW()),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', 'continental',
    '{"fr":"Administration système ARIS","en":"ARIS System Administration","ar":"إدارة نظام ARIS","pt":"Administração do Sistema ARIS"}',
    '{"fr":"Devenez expert en administration, configuration et maintenance de la plateforme ARIS"}',
    'administration-systeme', 'expert', 'published', 48, 85, NOW()),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', 'continental',
    '{"fr":"Gestion des formulaires","en":"Form Management","ar":"إدارة النماذج","pt":"Gestão de Formulários"}',
    '{"fr":"Concevez et déployez des formulaires de collecte avec le FormBuilder ARIS"}',
    'gestion-formulaires', 'intermediate', 'published', 18, 75, NOW()),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001', 'continental',
    '{"fr":"Interopérabilité DHIS2/FHIR","en":"DHIS2/FHIR Interoperability","ar":"التشغيل البيني DHIS2/FHIR","pt":"Interoperabilidade DHIS2/FHIR"}',
    '{"fr":"Configurez les échanges de données entre ARIS et les systèmes internationaux"}',
    'interoperabilite-dhis2-fhir', 'advanced', 'published', 32, 80, NOW())
ON CONFLICT (slug) DO NOTHING;

-- Demo modules for first course
INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes) VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', '{"fr":"Introduction à la surveillance","en":"Introduction to Surveillance"}', 1, 45),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', '{"fr":"Types de maladies animales","en":"Types of Animal Diseases"}', 2, 60),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000301', '{"fr":"Protocoles de déclaration","en":"Reporting Protocols"}', 3, 90),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000301', '{"fr":"Utilisation d''ARIS pour la surveillance","en":"Using ARIS for Surveillance"}', 4, 120),
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000301', '{"fr":"Cas pratiques terrain","en":"Field Case Studies"}', 5, 90),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000301', '{"fr":"Évaluation intermédiaire","en":"Mid-term Assessment"}', 6, 45),
  ('00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000301', '{"fr":"Projet de surveillance","en":"Surveillance Project"}', 7, 120),
  ('00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000301', '{"fr":"Examen final","en":"Final Exam"}', 8, 60)
ON CONFLICT DO NOTHING;

-- Demo enrollments
INSERT INTO enrollments (user_id, course_id, status, progress_percent, current_level) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 'completed', 100, 'beginner'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302', 'active', 67, 'intermediate'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000305', 'active', 82, 'intermediate')
ON CONFLICT (user_id, course_id) DO NOTHING;

-- Demo certification
INSERT INTO certifications (user_id, course_id, level, status, certificate_number, issued_at, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 'beginner', 'issued', 'ARIS-CERT-2026-00001', '2026-01-15T10:00:00Z', '2029-01-15T10:00:00Z')
ON CONFLICT (certificate_number) DO NOTHING;

-- Demo live sessions
INSERT INTO live_sessions (course_id, title, trainer_id, tenant_id, status, scheduled_at, duration_minutes) VALUES
  ('00000000-0000-0000-0000-000000000303',
    '{"fr":"Maîtriser les dashboards ARIS","en":"Mastering ARIS Dashboards"}',
    '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'scheduled', NOW() + INTERVAL '1 hour', 90),
  ('00000000-0000-0000-0000-000000000302',
    '{"fr":"Collecte offline en zones blanches","en":"Offline Collection in Blank Zones"}',
    '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', 'scheduled', NOW() + INTERVAL '1 day', 60),
  ('00000000-0000-0000-0000-000000000304',
    '{"fr":"Certification Expert — Soutenance Q&A","en":"Expert Certification — Defense Q&A"}',
    '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', 'scheduled', NOW() + INTERVAL '5 days', 120);
