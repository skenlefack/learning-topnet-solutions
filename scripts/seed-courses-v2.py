#!/usr/bin/env python3
"""
AU-IBAR Learning — Seed 8 ARIS courses from Word documents (v2)
Correct structure: H1=Module, H2=Lesson, H3=sub-section content
"""
import docx, os, sys, json, uuid, re, html as html_mod
sys.stdout.reconfigure(encoding='utf-8')

FOLDER = 'cours-aris'
TENANT_ID = '00000000-0000-0000-0000-000000000001'
TRAINER_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

# ============================================================================
# Course metadata
# ============================================================================
COURSES = [
    {'file': 'Cours-01_Prise-en-main-ARIS.docx', 'slug': 'prise-en-main-aris', 'level': 'beginner', 'hours': 12,
     'title': {'fr': "Prise en main d'ARIS", 'en': 'Getting Started with ARIS', 'pt': 'Introdução ao ARIS', 'ar': 'البدء مع نظام ARIS'},
     'desc': {'fr': "Découvrez l'architecture, les rôles utilisateurs, l'interface et les premières étapes pour naviguer dans ARIS.",
              'en': 'Discover the architecture, user roles, interface and first steps to navigate ARIS.',
              'pt': 'Descubra a arquitetura, funções de utilizador, interface e primeiros passos para navegar no ARIS.',
              'ar': 'اكتشف البنية وأدوار المستخدمين والواجهة والخطوات الأولى للتنقل في نظام ARIS.'},
     'tags': ['aris','debutant','interface','navigation']},
    {'file': 'Cours-02_Navigation-Tableaux-de-bord-ARIS.docx', 'slug': 'navigation-tableaux-bord-aris', 'level': 'beginner', 'hours': 15,
     'title': {'fr': 'Navigation et tableaux de bord ARIS', 'en': 'ARIS Navigation and Dashboards', 'pt': 'Navegação e painéis do ARIS', 'ar': 'التنقل ولوحات المعلومات في ARIS'},
     'desc': {'fr': "Maîtrisez la navigation dans les domaines métier, les tableaux de bord personnalisés et les outils BI intégrés.",
              'en': 'Master navigation across business domains, custom dashboards and integrated BI tools.',
              'pt': 'Domine a navegação nos domínios empresariais, painéis personalizados e ferramentas de BI integradas.',
              'ar': 'أتقن التنقل عبر مجالات الأعمال ولوحات المعلومات المخصصة وأدوات BI المدمجة.'},
     'tags': ['aris','navigation','dashboard','bi']},
    {'file': 'Cours-03_Collecte-de-donnees-ARIS.docx', 'slug': 'collecte-donnees-aris', 'level': 'intermediate', 'hours': 20,
     'title': {'fr': 'Collecte de données ARIS', 'en': 'ARIS Data Collection', 'pt': 'Recolha de dados do ARIS', 'ar': 'جمع البيانات في ARIS'},
     'desc': {'fr': "Apprenez à créer des formulaires, gérer des campagnes de collecte et soumettre des données terrain.",
              'en': 'Learn to create forms, manage data collection campaigns and submit field data.',
              'pt': 'Aprenda a criar formulários, gerir campanhas de recolha e submeter dados de campo.',
              'ar': 'تعلم إنشاء النماذج وإدارة حملات جمع البيانات وتقديم بيانات الميدان.'},
     'tags': ['aris','collecte','formulaires','campagnes']},
    {'file': 'Cours-04_Domaines-metier-ARIS.docx', 'slug': 'domaines-metier-aris', 'level': 'intermediate', 'hours': 25,
     'title': {'fr': 'Domaines métier ARIS', 'en': 'ARIS Business Domains', 'pt': 'Domínios de negócio do ARIS', 'ar': 'مجالات الأعمال في ARIS'},
     'desc': {'fr': "Explorez les six domaines métier d'ARIS : santé animale, élevage, pêche, commerce, faune et environnement.",
              'en': "Explore ARIS's six business domains: animal health, livestock, fisheries, trade, wildlife and environment.",
              'pt': 'Explore os seis domínios de negócio do ARIS: saúde animal, pecuária, pescas, comércio, fauna e ambiente.',
              'ar': 'استكشف مجالات الأعمال الستة في ARIS: الصحة الحيوانية والثروة الحيوانية والمصايد والتجارة والحياة البرية والبيئة.'},
     'tags': ['aris','domaines','sante-animale','elevage','peche']},
    {'file': 'Cours-05_Validation-et-workflow-ARIS.docx', 'slug': 'validation-workflow-aris', 'level': 'advanced', 'hours': 18,
     'title': {'fr': 'Validation et workflow ARIS', 'en': 'ARIS Validation and Workflow', 'pt': 'Validação e fluxo de trabalho do ARIS', 'ar': 'التحقق وسير العمل في ARIS'},
     'desc': {'fr': "Maîtrisez les flux de validation, les rôles de vérificateur et les processus d'approbation des données.",
              'en': 'Master validation workflows, reviewer roles and data approval processes.',
              'pt': 'Domine os fluxos de validação, funções de revisor e processos de aprovação de dados.',
              'ar': 'أتقن مسارات التحقق وأدوار المراجعين وعمليات الموافقة على البيانات.'},
     'tags': ['aris','validation','workflow','approbation']},
    {'file': 'Cours-06_Analyses-et-rapports-ARIS.docx', 'slug': 'analyses-rapports-aris', 'level': 'advanced', 'hours': 15,
     'title': {'fr': 'Analyses et rapports ARIS', 'en': 'ARIS Analytics and Reports', 'pt': 'Análises e relatórios do ARIS', 'ar': 'التحليلات والتقارير في ARIS'},
     'desc': {'fr': "Utilisez les outils d'analyse, créez des rapports personnalisés et exploitez les indicateurs clés.",
              'en': 'Use analytics tools, create custom reports and leverage key indicators.',
              'pt': 'Utilize ferramentas de análise, crie relatórios personalizados e aproveite indicadores-chave.',
              'ar': 'استخدم أدوات التحليل وأنشئ تقارير مخصصة واستفد من المؤشرات الرئيسية.'},
     'tags': ['aris','analyses','rapports','indicateurs']},
    {'file': 'Cours-07_Administration-systeme.docx', 'slug': 'administration-systeme-aris', 'level': 'expert', 'hours': 10,
     'title': {'fr': 'Administration système ARIS', 'en': 'ARIS System Administration', 'pt': 'Administração do sistema ARIS', 'ar': 'إدارة نظام ARIS'},
     'desc': {'fr': "Configurez les tenants, gérez les utilisateurs, les permissions et les paramètres système.",
              'en': 'Configure tenants, manage users, permissions and system settings.',
              'pt': 'Configure tenants, gerencie utilizadores, permissões e configurações do sistema.',
              'ar': 'قم بتهيئة المستأجرين وإدارة المستخدمين والأذونات وإعدادات النظام.'},
     'tags': ['aris','administration','systeme','configuration']},
    {'file': 'Cours-08_Integration-Interoperabilite.docx', 'slug': 'integration-interoperabilite-aris', 'level': 'expert', 'hours': 8,
     'title': {'fr': 'Intégration et interopérabilité ARIS', 'en': 'ARIS Integration and Interoperability', 'pt': 'Integração e interoperabilidade do ARIS', 'ar': 'التكامل والتشغيل البيني في ARIS'},
     'desc': {'fr': "Découvrez les API, les standards internationaux (OIE, FAO) et les mécanismes d'échange de données.",
              'en': 'Discover APIs, international standards (OIE, FAO) and data exchange mechanisms.',
              'pt': 'Descubra as APIs, normas internacionais (OIE, FAO) e mecanismos de troca de dados.',
              'ar': 'اكتشف واجهات برمجة التطبيقات والمعايير الدولية (OIE، FAO) وآليات تبادل البيانات.'},
     'tags': ['aris','api','interoperabilite','oie','fao']},
]

# ============================================================================
# Translation of module/lesson titles
# ============================================================================
TR = {
    'Module': {'en':'Module','pt':'Módulo','ar':'الوحدة'},
    'Leçon': {'en':'Lesson','pt':'Lição','ar':'الدرس'},
    'Exercice pratique': {'en':'Practical Exercise','pt':'Exercício prático','ar':'تمرين عملي'},
    'Exercices pratiques': {'en':'Practical Exercises','pt':'Exercícios práticos','ar':'تمارين عملية'},
    'Exercices': {'en':'Exercises','pt':'Exercícios','ar':'تمارين'},
    'Quiz': {'en':'Quiz','pt':'Questionário','ar':'اختبار'},
    'Quiz final': {'en':'Final Quiz','pt':'Questionário final','ar':'الاختبار النهائي'},
    'Quiz de validation finale': {'en':'Final Validation Quiz','pt':'Questionário de validação final','ar':'اختبار التحقق النهائي'},
    'Introduction': {'en':'Introduction','pt':'Introdução','ar':'مقدمة'},
    'Découvrir': {'en':'Discovering','pt':'Descobrir','ar':'اكتشاف'},
    'Comprendre': {'en':'Understanding','pt':'Compreender','ar':'فهم'},
    'Présentation': {'en':'Overview','pt':'Apresentação','ar':'نظرة عامة'},
    'Accéder': {'en':'Accessing','pt':'Aceder a','ar':'الوصول إلى'},
    'Créer': {'en':'Creating','pt':'Criar','ar':'إنشاء'},
    'Gérer': {'en':'Managing','pt':'Gerir','ar':'إدارة'},
    'Configurer': {'en':'Configuring','pt':'Configurar','ar':'تهيئة'},
    'Consulter': {'en':'Viewing','pt':'Consultar','ar':'عرض'},
    'Analyser': {'en':'Analysing','pt':'Analisar','ar':'تحليل'},
    'Explorer': {'en':'Exploring','pt':'Explorar','ar':'استكشاف'},
    'Corrigé': {'en':'Answer Key','pt':'Correção','ar':'الإجابات'},
    'Section': {'en':'Section','pt':'Secção','ar':'قسم'},
}

def translate(fr_title):
    en, pt, ar = fr_title, fr_title, fr_title
    # Sort by length descending to match longer phrases first
    for k in sorted(TR.keys(), key=len, reverse=True):
        if k in en:
            en = en.replace(k, TR[k]['en'], 1)
            pt = pt.replace(k, TR[k]['pt'], 1)
            ar = ar.replace(k, TR[k]['ar'], 1)
    return {'fr': fr_title, 'en': en, 'pt': pt, 'ar': ar}

# ============================================================================
# Skip patterns — these H1s are NOT real modules
# ============================================================================
SKIP_H1 = ['Avant-propos', 'Table des matières', 'Annexe', 'Glossaire',
           'Informations sur le document', 'Objectifs pédagogiques',
           'Introduction —', 'Introduction générale']

def is_real_module(h1_text):
    for skip in SKIP_H1:
        if h1_text.startswith(skip):
            return False
    return True

# ============================================================================
# Parse a Word document into proper structure
# ============================================================================
def para_to_html(para):
    """Convert a paragraph to HTML preserving bold/italic"""
    parts = []
    for run in para.runs:
        t = run.text
        if not t: continue
        t = html_mod.escape(t)
        if run.bold and run.italic:
            t = f'<strong><em>{t}</em></strong>'
        elif run.bold:
            t = f'<strong>{t}</strong>'
        elif run.italic:
            t = f'<em>{t}</em>'
        parts.append(t)
    return ''.join(parts)

def parse_course(filepath):
    doc = docx.Document(filepath)
    modules = []  # [{title_fr, lessons: [{title_fr, html}]}]
    cur_mod = None
    cur_les = None
    in_quiz = False
    in_skip = False

    for para in doc.paragraphs:
        style = para.style.name if para.style else ''
        text = para.text.strip()
        if not text: continue

        # H1 = Module boundary or skip section
        if style.startswith('Heading 1') or style == 'Title':
            in_quiz = 'Quiz' in text
            in_skip = not is_real_module(text) and not in_quiz

            if in_skip:
                cur_mod = None
                cur_les = None
                continue

            if in_quiz:
                # Quiz becomes a special module
                cur_mod = {'title_fr': text, 'lessons': [], 'is_quiz': True}
                modules.append(cur_mod)
                cur_les = None
                continue

            # Real module (H1 "Module X — ...")
            # Also catch "Exercices pratiques — Synthèse" as a module
            cur_mod = {'title_fr': text, 'lessons': [], 'is_quiz': False}
            modules.append(cur_mod)
            cur_les = None
            continue

        if in_skip:
            continue

        # H2 = Lesson (or exercise or quiz section)
        if style.startswith('Heading 2'):
            if cur_mod is None:
                continue
            if text.startswith('Corrigé') or text.startswith('Évaluation'):
                continue
            cur_les = {'title_fr': text, 'html_parts': []}
            cur_mod['lessons'].append(cur_les)
            continue

        # H3 = Sub-section heading within a lesson
        if style.startswith('Heading 3'):
            if cur_les is not None:
                cur_les['html_parts'].append(f'<h3>{html_mod.escape(text)}</h3>')
            elif cur_mod is not None and not cur_mod['lessons']:
                # H3 directly under H1 (e.g. quiz questions under H1)
                cur_les = {'title_fr': text, 'html_parts': []}
                cur_mod['lessons'].append(cur_les)
            continue

        # H4
        if style.startswith('Heading 4'):
            if cur_les:
                cur_les['html_parts'].append(f'<h4>{html_mod.escape(text)}</h4>')
            continue

        # Body content
        if cur_les is None:
            continue

        content = para_to_html(para)
        if not content.strip():
            continue

        if 'List' in style or 'Bullet' in style or (para.paragraph_format and para.paragraph_format.left_indent):
            cur_les['html_parts'].append(f'<li>{content}</li>')
        else:
            cur_les['html_parts'].append(f'<p>{content}</p>')

    # Post-process: wrap consecutive <li> in <ul>
    for mod in modules:
        for les in mod['lessons']:
            parts = les['html_parts']
            new_parts = []
            in_list = False
            for p in parts:
                if p.startswith('<li>'):
                    if not in_list:
                        new_parts.append('<ul>')
                        in_list = True
                    new_parts.append(p)
                else:
                    if in_list:
                        new_parts.append('</ul>')
                        in_list = False
                    new_parts.append(p)
            if in_list:
                new_parts.append('</ul>')
            les['html_parts'] = new_parts

    return modules

# ============================================================================
# SQL helpers
# ============================================================================
def esc(s):
    return s.replace("'", "''") if s else ''

def uid():
    return str(uuid.uuid4())

# ============================================================================
# Generate SQL
# ============================================================================
print("-- ================================================================")
print("-- AU-IBAR Learning — 8 ARIS Courses (v2 — correct programme)")
print("-- ================================================================")
print("BEGIN;")
print()
print("-- Purge all course data")
print("DELETE FROM academy_core.questions;")
print("DELETE FROM academy_core.assessment_attempts;")
print("DELETE FROM academy_core.assessments;")
print("DELETE FROM academy_core.progress_tracking;")
print("DELETE FROM academy_core.enrollments;")
print("DELETE FROM academy_core.lessons;")
print("DELETE FROM academy_core.modules;")
print("DELETE FROM academy_core.courses;")
print()

total_m = 0
total_l = 0

for ci, meta in enumerate(COURSES):
    path = os.path.join(FOLDER, meta['file'])
    if not os.path.exists(path):
        print(f"-- SKIP {meta['file']}")
        continue

    modules = parse_course(path)
    course_id = uid()

    # Filter empty modules
    modules = [m for m in modules if m['lessons']]

    print(f"-- === Course {ci+1}: {meta['title']['fr']} ({len(modules)} modules) ===")
    print(f"INSERT INTO academy_core.courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, tags, created_by, published_at)")
    print(f"VALUES ('{course_id}', '{TENANT_ID}', 'continental',")
    print(f"  '{esc(json.dumps(meta['title'], ensure_ascii=False))}'::jsonb,")
    print(f"  '{esc(json.dumps(meta['desc'], ensure_ascii=False))}'::jsonb,")
    print(f"  '{meta['slug']}', '{meta['level']}', 'published', {meta['hours']}, 70,")
    print(f"  ARRAY{meta['tags']}::text[], '{TRAINER_ID}', NOW());")
    print()

    for mi, mod in enumerate(modules):
        module_id = uid()
        mod_title = translate(mod['title_fr'])
        est_min = max(10, len(mod['lessons']) * 12)

        print(f"-- M{mi+1}: {mod['title_fr'][:70]}")
        print(f"INSERT INTO academy_core.modules (id, course_id, title, sort_order, estimated_minutes, is_required)")
        print(f"VALUES ('{module_id}', '{course_id}', '{esc(json.dumps(mod_title, ensure_ascii=False))}'::jsonb, {mi}, {est_min}, true);")
        total_m += 1

        for li, les in enumerate(mod['lessons']):
            lesson_id = uid()
            les_title = translate(les['title_fr'])
            content_html = '\n'.join(les.get('html_parts', []))
            duration = max(5, len(les.get('html_parts', [])) * 2)

            # Determine type
            t_lower = les['title_fr'].lower()
            les_type = 'practical' if ('exercice' in t_lower or 'pratique' in t_lower) else 'text'

            body = json.dumps({'body': content_html}, ensure_ascii=False)

            print(f"INSERT INTO academy_core.lessons (id, module_id, title, type, content, sort_order, duration_minutes, is_required)")
            print(f"VALUES ('{lesson_id}', '{module_id}', '{esc(json.dumps(les_title, ensure_ascii=False))}'::jsonb, '{les_type}', '{esc(body)}'::jsonb, {li}, {duration}, true);")
            total_l += 1

        print()

    # Assessment
    aid = uid()
    at = {'fr': f"Quiz — {meta['title']['fr']}", 'en': f"Quiz — {meta['title']['en']}",
          'pt': f"Questionário — {meta['title']['pt']}", 'ar': f"اختبار — {meta['title']['ar']}"}
    print(f"INSERT INTO academy_core.assessments (id, course_id, title, type, level, passing_score, time_limit_minutes, max_attempts, shuffle_questions, is_final)")
    print(f"VALUES ('{aid}', '{course_id}', '{esc(json.dumps(at, ensure_ascii=False))}'::jsonb, 'qcm', '{meta['level']}', 70, 30, 3, true, true);")
    print()

print("COMMIT;")
print(f"-- TOTAL: {total_m} modules, {total_l} lessons", file=sys.stderr)
