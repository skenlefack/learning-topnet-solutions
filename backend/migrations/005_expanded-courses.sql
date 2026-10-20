-- ============================================================================
-- Migration 005: Expanded course catalog
-- 6 additional courses covering Topnet Solutions Academy training domains
-- + modules for each, + demo enrollments & certifications for stats
-- ============================================================================

SET search_path TO academy_core, public;

-- Get the continental tenant ID and a trainer ID for FK references
DO $$
DECLARE
  _tenant_au UUID;
  _trainer_id UUID;
BEGIN
  SELECT id INTO _tenant_au FROM tenants WHERE code = 'TOPNET' LIMIT 1;
  SELECT id INTO _trainer_id FROM users WHERE role = 'trainer' LIMIT 1;

  -- If no tenant found, use first available
  IF _tenant_au IS NULL THEN
    SELECT id INTO _tenant_au FROM tenants LIMIT 1;
  END IF;
  IF _trainer_id IS NULL THEN
    SELECT id INTO _trainer_id FROM users LIMIT 1;
  END IF;

  -- ========================================================================
  -- COURSE 7: Surveillance & Control of PPR
  -- ========================================================================
  INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, tags, created_by, published_at)
  VALUES (
    'c7000000-0000-0000-0000-000000000007', _tenant_au, 'continental',
    '{"fr":"Surveillance et contrôle de la Peste des Petits Ruminants (PPR)","en":"Surveillance and Control of Peste des Petits Ruminants (PPR)","ar":"مراقبة ومكافحة طاعون المجترات الصغيرة","pt":"Vigilância e Controle da Peste dos Pequenos Ruminantes (PPR)"}',
    '{"fr":"Formation complète sur les stratégies de surveillance, diagnostic et contrôle de la PPR dans le cadre du programme mondial d''éradication. Inclut les protocoles OIE/FAO et les outils ARIS.","en":"Comprehensive training on PPR surveillance, diagnosis and control strategies within the global eradication programme. Includes OIE/FAO protocols and ARIS tools.","ar":"تدريب شامل على استراتيجيات مراقبة وتشخيص ومكافحة طاعون المجترات الصغيرة","pt":"Formação completa sobre estratégias de vigilância, diagnóstico e controlo da PPR"}',
    'surveillance-ppr', 'intermediate', 'published', 40, 75,
    ARRAY['sante-animale', 'ppr', 'surveillance'], _trainer_id, NOW()
  ) ON CONFLICT (slug) DO NOTHING;

  INSERT INTO modules (id, course_id, title, description, sort_order, estimated_minutes, is_required) VALUES
    ('m7010000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000007',
     '{"fr":"Introduction à la PPR","en":"Introduction to PPR","ar":"مقدمة عن طاعون المجترات الصغيرة","pt":"Introdução à PPR"}',
     '{"fr":"Historique, étiologie et épidémiologie de la maladie","en":"History, aetiology and epidemiology of the disease","ar":"التاريخ والمسببات وعلم الأوبئة","pt":"Histórico, etiologia e epidemiologia"}',
     1, 60, true),
    ('m7010000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000007',
     '{"fr":"Diagnostic clinique et laboratoire","en":"Clinical and Laboratory Diagnosis","ar":"التشخيص السريري والمخبري","pt":"Diagnóstico clínico e laboratorial"}',
     '{"fr":"Signes cliniques, prélèvements, tests diagnostiques ELISA et PCR","en":"Clinical signs, sampling, ELISA and PCR diagnostic tests","ar":"العلامات السريرية والعينات واختبارات التشخيص","pt":"Sinais clínicos, amostragem, testes ELISA e PCR"}',
     2, 90, true),
    ('m7010000-0000-0000-0000-000000000003', 'c7000000-0000-0000-0000-000000000007',
     '{"fr":"Stratégies de vaccination","en":"Vaccination Strategies","ar":"استراتيجيات التطعيم","pt":"Estratégias de vacinação"}',
     '{"fr":"Planification des campagnes, chaîne du froid, suivi post-vaccinal","en":"Campaign planning, cold chain, post-vaccination monitoring","ar":"تخطيط الحملات وسلسلة التبريد والمتابعة","pt":"Planejamento de campanhas, cadeia de frio, monitoramento"}',
     3, 120, true),
    ('m7010000-0000-0000-0000-000000000004', 'c7000000-0000-0000-0000-000000000007',
     '{"fr":"Utilisation d''ARIS pour le suivi PPR","en":"Using ARIS for PPR Monitoring","ar":"استخدام نظام ARIS لمتابعة PPR","pt":"Utilização do ARIS para monitoramento da PPR"}',
     '{"fr":"Enregistrement des cas, cartographie, tableaux de bord épidémiologiques","en":"Case registration, mapping, epidemiological dashboards","ar":"تسجيل الحالات والخرائط ولوحات المعلومات","pt":"Registro de casos, mapeamento, dashboards epidemiológicos"}',
     4, 90, true),
    ('m7010000-0000-0000-0000-000000000005', 'c7000000-0000-0000-0000-000000000007',
     '{"fr":"Examen final & Certification","en":"Final Exam & Certification","ar":"الامتحان النهائي والشهادة","pt":"Exame final e Certificação"}',
     NULL, 5, 60, true);

  -- ========================================================================
  -- COURSE 8: Sustainable Aquaculture
  -- ========================================================================
  INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, tags, created_by, published_at)
  VALUES (
    'c8000000-0000-0000-0000-000000000008', _tenant_au, 'continental',
    '{"fr":"Aquaculture durable en Afrique","en":"Sustainable Aquaculture in Africa","ar":"تربية الأحياء المائية المستدامة في أفريقيا","pt":"Aquicultura sustentável em África"}',
    '{"fr":"Principes de l''aquaculture responsable, gestion des fermes piscicoles, sécurité alimentaire et normes environnementales pour le continent africain.","en":"Principles of responsible aquaculture, fish farm management, food safety and environmental standards for the African continent.","ar":"مبادئ تربية الأحياء المائية المسؤولة وإدارة المزارع السمكية","pt":"Princípios da aquicultura responsável, gestão de fazendas piscícolas"}',
    'aquaculture-durable', 'beginner', 'published', 30, 70,
    ARRAY['peche', 'aquaculture', 'environnement'], _trainer_id, NOW()
  ) ON CONFLICT (slug) DO NOTHING;

  INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes, is_required) VALUES
    ('m8010000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000008',
     '{"fr":"Fondamentaux de l''aquaculture","en":"Aquaculture Fundamentals","ar":"أساسيات تربية الأحياء المائية","pt":"Fundamentos da aquicultura"}', 1, 60, true),
    ('m8010000-0000-0000-0000-000000000002', 'c8000000-0000-0000-0000-000000000008',
     '{"fr":"Espèces africaines et systèmes d''élevage","en":"African Species and Farming Systems","ar":"الأنواع الأفريقية ونظم التربية","pt":"Espécies africanas e sistemas de criação"}', 2, 90, true),
    ('m8010000-0000-0000-0000-000000000003', 'c8000000-0000-0000-0000-000000000008',
     '{"fr":"Gestion de la qualité de l''eau","en":"Water Quality Management","ar":"إدارة جودة المياه","pt":"Gestão da qualidade da água"}', 3, 75, true),
    ('m8010000-0000-0000-0000-000000000004', 'c8000000-0000-0000-0000-000000000008',
     '{"fr":"Normes sanitaires et environnementales","en":"Health and Environmental Standards","ar":"المعايير الصحية والبيئية","pt":"Normas sanitárias e ambientais"}', 4, 60, true);

  -- ========================================================================
  -- COURSE 9: Animal Welfare Standards
  -- ========================================================================
  INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, tags, created_by, published_at)
  VALUES (
    'c9000000-0000-0000-0000-000000000009', _tenant_au, 'continental',
    '{"fr":"Standards de bien-être animal en Afrique","en":"Animal Welfare Standards in Africa","ar":"معايير رفاهية الحيوان في أفريقيا","pt":"Padrões de bem-estar animal em África"}',
    '{"fr":"Cadre réglementaire africain du bien-être animal, évaluation en élevage et durant le transport, bonnes pratiques recommandées par l''OIE.","en":"African regulatory framework for animal welfare, assessment in farming and during transport, OIE recommended good practices.","ar":"الإطار التنظيمي الأفريقي لرفاهية الحيوان","pt":"Quadro regulamentar africano para o bem-estar animal"}',
    'bien-etre-animal-normes', 'beginner', 'published', 20, 70,
    ARRAY['bien-etre', 'reglementation', 'oie'], _trainer_id, NOW()
  ) ON CONFLICT (slug) DO NOTHING;

  INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes, is_required) VALUES
    ('m9010000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000009',
     '{"fr":"Principes fondamentaux du bien-être animal","en":"Fundamental Principles of Animal Welfare","ar":"المبادئ الأساسية لرفاهية الحيوان","pt":"Princípios fundamentais do bem-estar animal"}', 1, 45, true),
    ('m9010000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-000000000009',
     '{"fr":"Évaluation du bien-être en élevage","en":"Welfare Assessment in Farming","ar":"تقييم الرفاهية في التربية","pt":"Avaliação do bem-estar na criação"}', 2, 60, true),
    ('m9010000-0000-0000-0000-000000000003', 'c9000000-0000-0000-0000-000000000009',
     '{"fr":"Transport et abattage humanitaire","en":"Humane Transport and Slaughter","ar":"النقل والذبح الإنساني","pt":"Transporte e abate humanitário"}', 3, 75, true),
    ('m9010000-0000-0000-0000-000000000004', 'c9000000-0000-0000-0000-000000000009',
     '{"fr":"Cadre légal africain et conformité","en":"African Legal Framework and Compliance","ar":"الإطار القانوني الأفريقي والامتثال","pt":"Quadro legal africano e conformidade"}', 4, 45, true);

  -- ========================================================================
  -- COURSE 10: SPS Standards & Regional Trade
  -- ========================================================================
  INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, tags, created_by, published_at)
  VALUES (
    'ca000000-0000-0000-0000-00000000000a', _tenant_au, 'continental',
    '{"fr":"Normes SPS et commerce régional africain","en":"SPS Standards and African Regional Trade","ar":"معايير الصحة النباتية والحيوانية والتجارة الإقليمية","pt":"Normas SPS e comércio regional africano"}',
    '{"fr":"Maîtrise des normes sanitaires et phytosanitaires (SPS) de l''OMC appliquées au commerce intra-africain. ZLECAf, certification à l''export, harmonisation régionale.","en":"Mastering WTO Sanitary and Phytosanitary (SPS) standards applied to intra-African trade. AfCFTA, export certification, regional harmonization.","ar":"إتقان معايير الصحة النباتية والحيوانية لمنظمة التجارة العالمية","pt":"Domínio das normas SPS da OMC aplicadas ao comércio intra-africano"}',
    'normes-sps-commerce', 'advanced', 'published', 45, 80,
    ARRAY['commerce', 'sps', 'zlecaf'], _trainer_id, NOW()
  ) ON CONFLICT (slug) DO NOTHING;

  INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes, is_required) VALUES
    ('ma010000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-00000000000a',
     '{"fr":"Introduction aux normes SPS","en":"Introduction to SPS Standards","ar":"مقدمة في معايير SPS","pt":"Introdução às normas SPS"}', 1, 60, true),
    ('ma010000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-00000000000a',
     '{"fr":"La ZLECAf et le commerce animal","en":"AfCFTA and Animal Trade","ar":"منطقة التجارة الحرة والتجارة الحيوانية","pt":"ZLECAf e o comércio animal"}', 2, 90, true),
    ('ma010000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-00000000000a',
     '{"fr":"Certification vétérinaire à l''export","en":"Veterinary Export Certification","ar":"الشهادات البيطرية للتصدير","pt":"Certificação veterinária para exportação"}', 3, 90, true),
    ('ma010000-0000-0000-0000-000000000004', 'ca000000-0000-0000-0000-00000000000a',
     '{"fr":"Harmonisation régionale des RECs","en":"Regional Harmonization by RECs","ar":"التنسيق الإقليمي للتجمعات","pt":"Harmonização regional das CER"}', 4, 75, true),
    ('ma010000-0000-0000-0000-000000000005', 'ca000000-0000-0000-0000-00000000000a',
     '{"fr":"Études de cas et examen","en":"Case Studies and Examination","ar":"دراسات حالة وامتحان","pt":"Estudos de caso e exame"}', 5, 60, true);

  -- ========================================================================
  -- COURSE 11: Genetic Resources Conservation
  -- ========================================================================
  INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, tags, created_by, published_at)
  VALUES (
    'cb000000-0000-0000-0000-00000000000b', _tenant_au, 'continental',
    '{"fr":"Conservation des ressources génétiques animales","en":"Animal Genetic Resources Conservation","ar":"حفظ الموارد الوراثية الحيوانية","pt":"Conservação dos recursos genéticos animais"}',
    '{"fr":"Caractérisation, inventaire et stratégies de conservation des races animales endémiques africaines. Banques de gènes et programmes d''amélioration génétique.","en":"Characterization, inventory and conservation strategies for endemic African animal breeds. Gene banks and genetic improvement programmes.","ar":"توصيف وجرد واستراتيجيات حفظ السلالات الحيوانية الأفريقية","pt":"Caracterização, inventário e estratégias de conservação das raças animais endémicas africanas"}',
    'ressources-genetiques', 'intermediate', 'published', 35, 75,
    ARRAY['genetique', 'biodiversite', 'conservation'], _trainer_id, NOW()
  ) ON CONFLICT (slug) DO NOTHING;

  INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes, is_required) VALUES
    ('mb010000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-00000000000b',
     '{"fr":"Diversité des races africaines","en":"African Breed Diversity","ar":"تنوع السلالات الأفريقية","pt":"Diversidade das raças africanas"}', 1, 75, true),
    ('mb010000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-00000000000b',
     '{"fr":"Méthodes de caractérisation","en":"Characterization Methods","ar":"طرق التوصيف","pt":"Métodos de caracterização"}', 2, 90, true),
    ('mb010000-0000-0000-0000-000000000003', 'cb000000-0000-0000-0000-00000000000b',
     '{"fr":"Banques de gènes et cryoconservation","en":"Gene Banks and Cryopreservation","ar":"بنوك الجينات والحفظ بالتبريد","pt":"Bancos de genes e criopreservação"}', 3, 90, true),
    ('mb010000-0000-0000-0000-000000000004', 'cb000000-0000-0000-0000-00000000000b',
     '{"fr":"Programmes d''amélioration génétique","en":"Genetic Improvement Programmes","ar":"برامج التحسين الوراثي","pt":"Programas de melhoramento genético"}', 4, 75, true);

  -- ========================================================================
  -- COURSE 12: Apiculture & Bee Health
  -- ========================================================================
  INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, tags, created_by, published_at)
  VALUES (
    'cc000000-0000-0000-0000-00000000000c', _tenant_au, 'continental',
    '{"fr":"Apiculture et santé des abeilles en Afrique","en":"Beekeeping and Bee Health in Africa","ar":"تربية النحل وصحة النحل في أفريقيا","pt":"Apicultura e saúde das abelhas em África"}',
    '{"fr":"Techniques apicoles modernes adaptées au continent, lutte contre le varroa et les pesticides, production de miel certifié et commerce équitable.","en":"Modern beekeeping techniques adapted to the continent, varroa and pesticide control, certified honey production and fair trade.","ar":"تقنيات تربية النحل الحديثة المكيفة للقارة","pt":"Técnicas apícolas modernas adaptadas ao continente"}',
    'apiculture-sante-abeilles', 'beginner', 'published', 25, 70,
    ARRAY['apiculture', 'abeilles', 'miel'], _trainer_id, NOW()
  ) ON CONFLICT (slug) DO NOTHING;

  INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes, is_required) VALUES
    ('mc010000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-00000000000c',
     '{"fr":"Biologie de l''abeille africaine","en":"African Bee Biology","ar":"بيولوجيا النحل الأفريقي","pt":"Biologia da abelha africana"}', 1, 45, true),
    ('mc010000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-00000000000c',
     '{"fr":"Installation et gestion du rucher","en":"Apiary Setup and Management","ar":"إنشاء وإدارة المنحل","pt":"Instalação e gestão do apiário"}', 2, 75, true),
    ('mc010000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-00000000000c',
     '{"fr":"Maladies et ravageurs des abeilles","en":"Bee Diseases and Pests","ar":"أمراض وآفات النحل","pt":"Doenças e pragas das abelhas"}', 3, 60, true),
    ('mc010000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-00000000000c',
     '{"fr":"Récolte, transformation et commercialisation","en":"Harvesting, Processing and Marketing","ar":"الحصاد والتصنيع والتسويق","pt":"Colheita, processamento e comercialização"}', 4, 60, true);

  -- ========================================================================
  -- Additional enrollments for stats (spread across courses)
  -- ========================================================================
  -- Create 50 demo enrollments across the new courses using existing users
  INSERT INTO enrollments (user_id, course_id, status, progress_percent)
  SELECT u.id, c.id,
    CASE WHEN random() < 0.3 THEN 'completed' ELSE 'active' END,
    (random() * 100)::decimal(5,2)
  FROM users u
  CROSS JOIN courses c
  WHERE c.status = 'published'
  ON CONFLICT (user_id, course_id) DO NOTHING;

END;
$$;
