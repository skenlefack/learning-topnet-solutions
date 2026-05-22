BEGIN;

DELETE FROM academy_core.learning_path_courses;
DELETE FROM academy_core.learning_path_enrollments;
DELETE FROM academy_core.learning_paths;

-- PATH 1: Débutant (Cours 1 + 2)
INSERT INTO academy_core.learning_paths (id, tenant_id, title, description, slug, estimated_hours, passing_score, is_published, tags, created_by)
VALUES (
  'aaaa0001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"fr":"ARIS — Formation certifiante Niveau Débutant","en":"ARIS — Beginner Certification Track","pt":"ARIS — Formação certificada Nível Iniciante","ar":"ARIS — مسار شهادة المستوى المبتدئ"}'::jsonb,
  '{"fr":"Maîtrisez les bases d''ARIS : architecture, interface, navigation et tableaux de bord. Validez les 2 cours pour obtenir le Certificat Foundation.","en":"Master the ARIS basics: architecture, interface, navigation and dashboards. Complete both courses to earn the Foundation Certificate.","pt":"Domine as bases do ARIS: arquitetura, interface, navegação e painéis. Complete os 2 cursos para obter o Certificado Foundation.","ar":"أتقن أساسيات ARIS: البنية والواجهة والتنقل ولوحات المعلومات. أكمل الدورتين للحصول على شهادة التأسيس."}'::jsonb,
  'aris-certification-debutant', 27, 70, true,
  ARRAY['aris','certification','debutant','foundation']::text[],
  'aaaaaaaa-0000-0000-0000-000000000001'
);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0001-0000-0000-0000-000000000001', 'd832ea01-a669-4bec-88f1-6151264f5bc4', 0, true);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0001-0000-0000-0000-000000000001', '01db2833-90d7-48fa-b060-b170e2b99264', 1, true);

-- PATH 2: Intermédiaire (Cours 3 + 4)
INSERT INTO academy_core.learning_paths (id, tenant_id, title, description, slug, estimated_hours, passing_score, is_published, tags, created_by)
VALUES (
  'aaaa0002-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"fr":"ARIS — Formation certifiante Niveau Intermédiaire","en":"ARIS — Intermediate Certification Track","pt":"ARIS — Formação certificada Nível Intermédio","ar":"ARIS — مسار شهادة المستوى المتوسط"}'::jsonb,
  '{"fr":"Approfondissez vos compétences : collecte de données et domaines métier. Prérequis : Certificat Débutant.","en":"Deepen your skills: data collection and business domains. Prerequisite: Beginner Certificate.","pt":"Aprofunde as suas competências: recolha de dados e domínios de negócio. Pré-requisito: Certificado Iniciante.","ar":"عمّق مهاراتك: جمع البيانات ومجالات الأعمال. المتطلب: شهادة المبتدئ."}'::jsonb,
  'aris-certification-intermediaire', 45, 70, true,
  ARRAY['aris','certification','intermediaire','practitioner']::text[],
  'aaaaaaaa-0000-0000-0000-000000000001'
);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0002-0000-0000-0000-000000000001', '8134549b-d13f-4307-a4d6-a8288adc9543', 0, true);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0002-0000-0000-0000-000000000001', '7b6ae064-137d-4e18-a413-7832251281a4', 1, true);

-- PATH 3: Avancé (Cours 5 + 6)
INSERT INTO academy_core.learning_paths (id, tenant_id, title, description, slug, estimated_hours, passing_score, is_published, tags, created_by)
VALUES (
  'aaaa0003-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"fr":"ARIS — Formation certifiante Niveau Avancé","en":"ARIS — Advanced Certification Track","pt":"ARIS — Formação certificada Nível Avançado","ar":"ARIS — مسار شهادة المستوى المتقدم"}'::jsonb,
  '{"fr":"Maîtrisez la validation, les workflows et les analyses avancées. Prérequis : Certificat Intermédiaire.","en":"Master validation, workflows and advanced analytics. Prerequisite: Intermediate Certificate.","pt":"Domine a validação, fluxos de trabalho e análises avançadas. Pré-requisito: Certificado Intermédio.","ar":"أتقن التحقق وسير العمل والتحليلات المتقدمة. المتطلب: شهادة المتوسط."}'::jsonb,
  'aris-certification-avance', 33, 70, true,
  ARRAY['aris','certification','avance','senior-specialist']::text[],
  'aaaaaaaa-0000-0000-0000-000000000001'
);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0003-0000-0000-0000-000000000001', '9bb9d945-6cec-4ece-94aa-4aa4dc559a00', 0, true);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0003-0000-0000-0000-000000000001', '2e5a94ff-820c-4d21-a1c4-fab68bb2cc6f', 1, true);

-- PATH 4: Expert (Cours 7 + 8)
INSERT INTO academy_core.learning_paths (id, tenant_id, title, description, slug, estimated_hours, passing_score, is_published, tags, created_by)
VALUES (
  'aaaa0004-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"fr":"ARIS — Formation certifiante Niveau Expert","en":"ARIS — Expert Certification Track","pt":"ARIS — Formação certificada Nível Especialista","ar":"ARIS — مسار شهادة مستوى الخبير"}'::jsonb,
  '{"fr":"Atteignez l''excellence : administration système et interopérabilité internationale. Prérequis : Certificat Avancé.","en":"Achieve excellence: system administration and international interoperability. Prerequisite: Advanced Certificate.","pt":"Alcance a excelência: administração do sistema e interoperabilidade internacional. Pré-requisito: Certificado Avançado.","ar":"حقق التميز: إدارة النظام والتشغيل البيني الدولي. المتطلب: الشهادة المتقدمة."}'::jsonb,
  'aris-certification-expert', 18, 70, true,
  ARRAY['aris','certification','expert','master']::text[],
  'aaaaaaaa-0000-0000-0000-000000000001'
);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0004-0000-0000-0000-000000000001', '3843df9a-bab0-4784-8e8f-9c02d25194be', 0, true);
INSERT INTO academy_core.learning_path_courses (id, path_id, course_id, sort_order, is_required)
VALUES (uuid_generate_v4(), 'aaaa0004-0000-0000-0000-000000000001', '666f3492-3c64-4132-b7d8-612bdea416a1', 1, true);

COMMIT;
