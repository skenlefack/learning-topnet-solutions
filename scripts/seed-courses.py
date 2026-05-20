#!/usr/bin/env python3
"""
AU-IBAR Learning — Seed 8 ARIS courses from Word documents
Extracts structure, content, generates HTML, translates titles, outputs SQL
"""
import docx
import os
import sys
import json
import uuid
import re
import html

sys.stdout.reconfigure(encoding='utf-8')

FOLDER = 'cours-aris'
TENANT_ID = '00000000-0000-0000-0000-000000000001'
TRAINER_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

# ============================================================================
# Course metadata (manual mapping for proper titles + translations)
# ============================================================================
COURSE_META = [
    {
        'file': 'Cours-01_Prise-en-main-ARIS.docx',
        'slug': 'prise-en-main-aris',
        'level': 'beginner',
        'hours': 12,
        'title': {
            'fr': 'Prise en main d\'ARIS',
            'en': 'Getting Started with ARIS',
            'pt': 'Introdução ao ARIS',
            'ar': 'البدء مع نظام ARIS'
        },
        'description': {
            'fr': 'Découvrez l\'architecture, les rôles utilisateurs, l\'interface et les premières étapes pour naviguer dans ARIS.',
            'en': 'Discover the architecture, user roles, interface and first steps to navigate ARIS.',
            'pt': 'Descubra a arquitetura, funções de utilizador, interface e primeiros passos para navegar no ARIS.',
            'ar': 'اكتشف البنية وأدوار المستخدمين والواجهة والخطوات الأولى للتنقل في نظام ARIS.'
        },
        'tags': ['aris', 'debutant', 'interface', 'navigation']
    },
    {
        'file': 'Cours-02_Navigation-Tableaux-de-bord-ARIS.docx',
        'slug': 'navigation-tableaux-de-bord-aris',
        'level': 'beginner',
        'hours': 15,
        'title': {
            'fr': 'Navigation et tableaux de bord ARIS',
            'en': 'ARIS Navigation and Dashboards',
            'pt': 'Navegação e painéis do ARIS',
            'ar': 'التنقل ولوحات المعلومات في ARIS'
        },
        'description': {
            'fr': 'Maîtrisez la navigation dans les domaines métier, les tableaux de bord personnalisés et les outils BI intégrés.',
            'en': 'Master navigation across business domains, custom dashboards and integrated BI tools.',
            'pt': 'Domine a navegação nos domínios empresariais, painéis personalizados e ferramentas de BI integradas.',
            'ar': 'أتقن التنقل عبر مجالات الأعمال ولوحات المعلومات المخصصة وأدوات BI المدمجة.'
        },
        'tags': ['aris', 'navigation', 'dashboard', 'bi']
    },
    {
        'file': 'Cours-03_Collecte-de-donnees-ARIS.docx',
        'slug': 'collecte-donnees-aris',
        'level': 'intermediate',
        'hours': 20,
        'title': {
            'fr': 'Collecte de données ARIS',
            'en': 'ARIS Data Collection',
            'pt': 'Recolha de dados do ARIS',
            'ar': 'جمع البيانات في ARIS'
        },
        'description': {
            'fr': 'Apprenez à créer des formulaires, gérer des campagnes de collecte et soumettre des données terrain.',
            'en': 'Learn to create forms, manage data collection campaigns and submit field data.',
            'pt': 'Aprenda a criar formulários, gerir campanhas de recolha e submeter dados de campo.',
            'ar': 'تعلم إنشاء النماذج وإدارة حملات جمع البيانات وتقديم بيانات الميدان.'
        },
        'tags': ['aris', 'collecte', 'formulaires', 'campagnes']
    },
    {
        'file': 'Cours-04_Domaines-metier-ARIS.docx',
        'slug': 'domaines-metier-aris',
        'level': 'intermediate',
        'hours': 25,
        'title': {
            'fr': 'Domaines métier ARIS',
            'en': 'ARIS Business Domains',
            'pt': 'Domínios de negócio do ARIS',
            'ar': 'مجالات الأعمال في ARIS'
        },
        'description': {
            'fr': 'Explorez les six domaines métier d\'ARIS : santé animale, élevage, pêche, commerce, faune et environnement.',
            'en': 'Explore the six ARIS business domains: animal health, livestock, fisheries, trade, wildlife and environment.',
            'pt': 'Explore os seis domínios de negócio do ARIS: saúde animal, pecuária, pescas, comércio, fauna e ambiente.',
            'ar': 'استكشف مجالات الأعمال الستة في ARIS: الصحة الحيوانية والثروة الحيوانية والمصايد والتجارة والحياة البرية والبيئة.'
        },
        'tags': ['aris', 'domaines', 'sante-animale', 'elevage', 'peche']
    },
    {
        'file': 'Cours-05_Validation-et-workflow-ARIS.docx',
        'slug': 'validation-workflow-aris',
        'level': 'advanced',
        'hours': 18,
        'title': {
            'fr': 'Validation et workflow ARIS',
            'en': 'ARIS Validation and Workflow',
            'pt': 'Validação e fluxo de trabalho do ARIS',
            'ar': 'التحقق وسير العمل في ARIS'
        },
        'description': {
            'fr': 'Maîtrisez les flux de validation, les rôles de vérificateur et les processus d\'approbation des données.',
            'en': 'Master validation workflows, reviewer roles and data approval processes.',
            'pt': 'Domine os fluxos de validação, funções de revisor e processos de aprovação de dados.',
            'ar': 'أتقن مسارات التحقق وأدوار المراجعين وعمليات الموافقة على البيانات.'
        },
        'tags': ['aris', 'validation', 'workflow', 'approbation']
    },
    {
        'file': 'Cours-06_Analyses-et-rapports-ARIS.docx',
        'slug': 'analyses-rapports-aris',
        'level': 'advanced',
        'hours': 15,
        'title': {
            'fr': 'Analyses et rapports ARIS',
            'en': 'ARIS Analytics and Reports',
            'pt': 'Análises e relatórios do ARIS',
            'ar': 'التحليلات والتقارير في ARIS'
        },
        'description': {
            'fr': 'Utilisez les outils d\'analyse, créez des rapports personnalisés et exploitez les indicateurs clés.',
            'en': 'Use analytics tools, create custom reports and leverage key indicators.',
            'pt': 'Utilize ferramentas de análise, crie relatórios personalizados e aproveite indicadores-chave.',
            'ar': 'استخدم أدوات التحليل وأنشئ تقارير مخصصة واستفد من المؤشرات الرئيسية.'
        },
        'tags': ['aris', 'analyses', 'rapports', 'indicateurs']
    },
    {
        'file': 'Cours-07_Administration-systeme.docx',
        'slug': 'administration-systeme-aris',
        'level': 'expert',
        'hours': 10,
        'title': {
            'fr': 'Administration système ARIS',
            'en': 'ARIS System Administration',
            'pt': 'Administração do sistema ARIS',
            'ar': 'إدارة نظام ARIS'
        },
        'description': {
            'fr': 'Configurez les tenants, gérez les utilisateurs, les permissions et les paramètres système.',
            'en': 'Configure tenants, manage users, permissions and system settings.',
            'pt': 'Configure tenants, gerencie utilizadores, permissões e configurações do sistema.',
            'ar': 'قم بتهيئة المستأجرين وإدارة المستخدمين والأذونات وإعدادات النظام.'
        },
        'tags': ['aris', 'administration', 'systeme', 'configuration']
    },
    {
        'file': 'Cours-08_Integration-Interoperabilite.docx',
        'slug': 'integration-interoperabilite-aris',
        'level': 'expert',
        'hours': 8,
        'title': {
            'fr': 'Intégration et interopérabilité ARIS',
            'en': 'ARIS Integration and Interoperability',
            'pt': 'Integração e interoperabilidade do ARIS',
            'ar': 'التكامل والتشغيل البيني في ARIS'
        },
        'description': {
            'fr': 'Découvrez les API, les standards internationaux (OIE, FAO) et les mécanismes d\'échange de données.',
            'en': 'Discover APIs, international standards (OIE, FAO) and data exchange mechanisms.',
            'pt': 'Descubra as APIs, normas internacionais (OIE, FAO) e mecanismos de troca de dados.',
            'ar': 'اكتشف واجهات برمجة التطبيقات والمعايير الدولية (OIE، FAO) وآليات تبادل البيانات.'
        },
        'tags': ['aris', 'api', 'interoperabilite', 'oie', 'fao']
    },
]

# ============================================================================
# Translation helpers for module/lesson titles
# ============================================================================
COMMON_TRANSLATIONS = {
    'Leçon': {'en': 'Lesson', 'pt': 'Lição', 'ar': 'الدرس'},
    'Module': {'en': 'Module', 'pt': 'Módulo', 'ar': 'الوحدة'},
    'Exercice pratique': {'en': 'Practical Exercise', 'pt': 'Exercício prático', 'ar': 'تمرين عملي'},
    'Exercices pratiques': {'en': 'Practical Exercises', 'pt': 'Exercícios práticos', 'ar': 'تمارين عملية'},
    'Exercices': {'en': 'Exercises', 'pt': 'Exercícios', 'ar': 'تمارين'},
    'Introduction': {'en': 'Introduction', 'pt': 'Introdução', 'ar': 'مقدمة'},
    'Quiz': {'en': 'Quiz', 'pt': 'Questionário', 'ar': 'اختبار'},
    'Section': {'en': 'Section', 'pt': 'Secção', 'ar': 'قسم'},
    'questions': {'en': 'questions', 'pt': 'perguntas', 'ar': 'أسئلة'},
    'Présentation': {'en': 'Overview', 'pt': 'Apresentação', 'ar': 'نظرة عامة'},
    'Accéder': {'en': 'Access', 'pt': 'Aceder', 'ar': 'الوصول'},
    'Créer': {'en': 'Create', 'pt': 'Criar', 'ar': 'إنشاء'},
    'Gérer': {'en': 'Manage', 'pt': 'Gerir', 'ar': 'إدارة'},
    'Comprendre': {'en': 'Understanding', 'pt': 'Compreender', 'ar': 'فهم'},
    'Configurer': {'en': 'Configure', 'pt': 'Configurar', 'ar': 'تهيئة'},
}

def translate_title(fr_title):
    """Simple rule-based translation of module/lesson titles"""
    en = fr_title
    pt = fr_title
    ar = fr_title

    for fr_word, trans in COMMON_TRANSLATIONS.items():
        if fr_word in en:
            en = en.replace(fr_word, trans['en'])
            pt = pt.replace(fr_word, trans['pt'])
            ar = ar.replace(fr_word, trans['ar'])

    # Keep structure markers like "1.1", "—" etc
    return {'fr': fr_title, 'en': en, 'pt': pt, 'ar': ar}

# ============================================================================
# Word document parser — extract modules and lessons with HTML content
# ============================================================================
def parse_course(filepath):
    doc = docx.Document(filepath)
    modules = []
    cur_mod = None
    cur_les = None

    for para in doc.paragraphs:
        style = para.style.name if para.style else ''
        text = para.text.strip()

        if style.startswith('Heading 1') or style == 'Title':
            continue

        if style.startswith('Heading 2'):
            if text:
                cur_mod = {'title_fr': text, 'lessons': []}
                modules.append(cur_mod)
                cur_les = None
            continue

        if style.startswith('Heading 3'):
            if cur_mod is None:
                cur_mod = {'title_fr': 'Introduction', 'lessons': []}
                modules.append(cur_mod)
            if text:
                cur_les = {'title_fr': text, 'html_parts': []}
                cur_mod['lessons'].append(cur_les)
            continue

        if not text:
            continue

        # Build HTML from paragraph
        h = ''
        if style.startswith('Heading 4'):
            h = f'<h4>{html.escape(text)}</h4>'
        elif style.startswith('List'):
            h = f'<li>{html.escape(text)}</li>'
        elif 'Bullet' in style or para.paragraph_format.left_indent:
            h = f'<li>{html.escape(text)}</li>'
        else:
            # Check for bold/italic runs
            parts = []
            for run in para.runs:
                t = run.text
                if not t: continue
                t = html.escape(t)
                if run.bold and run.italic:
                    t = f'<strong><em>{t}</em></strong>'
                elif run.bold:
                    t = f'<strong>{t}</strong>'
                elif run.italic:
                    t = f'<em>{t}</em>'
                parts.append(t)
            h = f'<p>{"".join(parts)}</p>'

        if cur_les:
            cur_les['html_parts'].append(h)
        elif cur_mod:
            if not cur_mod['lessons']:
                cur_les = {'title_fr': 'Contenu', 'html_parts': [h]}
                cur_mod['lessons'].append(cur_les)
            else:
                cur_mod['lessons'][-1]['html_parts'].append(h)

    # Filter: remove empty modules and annexes
    filtered = []
    for m in modules:
        t = m['title_fr']
        if not t or t.startswith('Annexe') or t.startswith('Corrigé'):
            continue
        # Remove modules with 0 lessons
        m['lessons'] = [l for l in m['lessons'] if l['html_parts'] or l['title_fr'] != 'Contenu']
        if m['lessons'] or any(kw in t.lower() for kw in ['leçon', 'exercice', 'quiz', 'section', 'module']):
            filtered.append(m)

    # Merge consecutive empty modules into previous
    result = []
    for m in filtered:
        if m['lessons']:
            result.append(m)
        elif result and not m['title_fr']:
            continue  # skip empty unnamed modules
        else:
            result.append(m)

    return result

# ============================================================================
# Generate SQL
# ============================================================================
def esc(s):
    """Escape single quotes for SQL"""
    return s.replace("'", "''") if s else ''

def gen_uuid():
    return str(uuid.uuid4())

print("-- ========================================================")
print("-- AU-IBAR Learning — 8 ARIS Courses seed")
print("-- Generated by seed-courses.py")
print("-- ========================================================")
print()
print("BEGIN;")
print()

for ci, meta in enumerate(COURSE_META):
    filepath = os.path.join(FOLDER, meta['file'])
    if not os.path.exists(filepath):
        print(f"-- SKIP: {meta['file']} not found")
        continue

    modules = parse_course(filepath)
    course_id = gen_uuid()

    print(f"-- ====== Course {ci+1}: {meta['title']['fr']} ======")
    print(f"INSERT INTO academy_core.courses (id, tenant_id, tenant_level, title, description, slug, level, category_id, status, estimated_hours, passing_score, tags, created_by, published_at)")
    print(f"VALUES (")
    print(f"  '{course_id}',")
    print(f"  '{TENANT_ID}',")
    print(f"  'continental',")
    print(f"  '{esc(json.dumps(meta['title'], ensure_ascii=False))}'::jsonb,")
    print(f"  '{esc(json.dumps(meta['description'], ensure_ascii=False))}'::jsonb,")
    print(f"  '{meta['slug']}',")
    print(f"  '{meta['level']}',")
    print(f"  NULL,")
    print(f"  'published',")
    print(f"  {meta['hours']},")
    print(f"  70,")
    print(f"  ARRAY{meta['tags']}::text[],")
    print(f"  '{TRAINER_ID}',")
    print(f"  NOW()")
    print(f");")
    print()

    for mi, mod in enumerate(modules):
        module_id = gen_uuid()
        mod_title = translate_title(mod['title_fr'])
        est_min = max(5, len(mod['lessons']) * 10)

        print(f"-- Module {mi+1}: {mod['title_fr'][:60]}")
        print(f"INSERT INTO academy_core.modules (id, course_id, title, sort_order, estimated_minutes, is_required)")
        print(f"VALUES ('{module_id}', '{course_id}', '{esc(json.dumps(mod_title, ensure_ascii=False))}'::jsonb, {mi}, {est_min}, true);")

        for li, les in enumerate(mod['lessons']):
            lesson_id = gen_uuid()
            les_title = translate_title(les['title_fr'])
            content_html = '\n'.join(les.get('html_parts', []))
            # Wrap list items in <ul>
            content_html = re.sub(r'((?:<li>.*?</li>\n?)+)', r'<ul>\1</ul>', content_html)
            duration = max(3, len(les.get('html_parts', [])) * 2)

            # Determine lesson type
            les_type = 'text'
            lower_title = les['title_fr'].lower()
            if 'exercice' in lower_title or 'pratique' in lower_title:
                les_type = 'practical'

            content_json = json.dumps({'body': content_html}, ensure_ascii=False)

            print(f"INSERT INTO academy_core.lessons (id, module_id, title, type, content, sort_order, duration_minutes, is_required)")
            print(f"VALUES ('{lesson_id}', '{module_id}', '{esc(json.dumps(les_title, ensure_ascii=False))}'::jsonb, '{les_type}', '{esc(content_json)}'::jsonb, {li}, {duration}, true);")

        print()

    # Generate assessment for each course
    assessment_id = gen_uuid()
    assess_title = {
        'fr': f"Quiz — {meta['title']['fr']}",
        'en': f"Quiz — {meta['title']['en']}",
        'pt': f"Questionário — {meta['title']['pt']}",
        'ar': f"اختبار — {meta['title']['ar']}"
    }
    print(f"-- Assessment for course {ci+1}")
    print(f"INSERT INTO academy_core.assessments (id, course_id, title, type, level, passing_score, time_limit_minutes, max_attempts, shuffle_questions, is_final)")
    print(f"VALUES ('{assessment_id}', '{course_id}', '{esc(json.dumps(assess_title, ensure_ascii=False))}'::jsonb, 'qcm', '{meta['level']}', 70, 30, 3, true, true);")
    print()

print("COMMIT;")
print()
print("-- Done! Verify:")
print("-- SELECT count(*) FROM academy_core.courses;")
print("-- SELECT c.title->>'fr', count(m.id) FROM academy_core.courses c LEFT JOIN academy_core.modules m ON m.course_id=c.id GROUP BY c.id;")
