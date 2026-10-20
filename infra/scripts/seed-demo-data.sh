#!/bin/bash
# ============================================================================
# ARIS Academy — Seed Demo/Reference Data
# Inserts tenant hierarchy and optionally demo data for development
#
# Usage:
#   ./infra/scripts/seed-demo-data.sh              # Full demo data
#   ./infra/scripts/seed-demo-data.sh --production  # Essential reference only
#
# Idempotent: uses ON CONFLICT DO NOTHING — safe to run multiple times
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONTAINER_NAME="${CONTAINER_NAME:-academy-postgres}"
DB_NAME="${DB_NAME:-academy}"
DB_USER="${DB_USER:-academy}"
PRODUCTION_MODE=false

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --production)
            PRODUCTION_MODE=true
            ;;
        --help|-h)
            echo "Usage: $0 [--production]"
            echo ""
            echo "Options:"
            echo "  --production  Only insert essential reference data (tenants, hierarchy)"
            echo "                Skips demo users, courses, enrollments, etc."
            echo ""
            echo "Without --production, inserts full demo data for development."
            exit 0
            ;;
        *)
            echo "ERROR: Unknown argument: $arg"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
echo "=============================================="
echo " ARIS Academy — Seed Data"
echo "=============================================="

if [ "$PRODUCTION_MODE" = true ]; then
    echo " Mode: PRODUCTION (reference data only)"
else
    echo " Mode: DEVELOPMENT (full demo data)"
fi
echo ""

if ! command -v docker &>/dev/null; then
    echo "ERROR: docker command not found"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running"
    exit 1
fi

# ---------------------------------------------------------------------------
# Helper: execute SQL in container
# ---------------------------------------------------------------------------
exec_sql() {
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

exec_sql_quiet() {
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null
}

# ============================================================================
# PHASE 1: Essential Reference Data (always inserted)
# ============================================================================
echo "[1/4] Inserting tenant hierarchy (Continental > RECs > Countries)..."

exec_sql "
SET search_path TO academy_core, public;

-- Continental level: Topnet Solutions
INSERT INTO tenants (id, name, code, level, parent_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Topnet Solutions Continental', 'TOPNET', 'continental', NULL)
ON CONFLICT (code) DO NOTHING;

-- Regional Economic Communities (RECs)
INSERT INTO tenants (id, name, code, level, parent_id) VALUES
    ('00000000-0000-0000-0000-000000000010', 'ECOWAS', 'ECOWAS', 'rec', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000011', 'EAC', 'EAC', 'rec', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000012', 'SADC', 'SADC', 'rec', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000013', 'IGAD', 'IGAD', 'rec', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000014', 'ECCAS', 'ECCAS', 'rec', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000015', 'UMA', 'UMA', 'rec', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000016', 'COMESA', 'COMESA', 'rec', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000017', 'CEN-SAD', 'CENSAD', 'rec', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (code) DO NOTHING;

-- Countries (representative sample per REC)
INSERT INTO tenants (id, name, code, level, parent_id) VALUES
    -- ECOWAS countries
    ('00000000-0000-0000-0000-000000000101', 'Nigeria', 'NG', 'country', '00000000-0000-0000-0000-000000000010'),
    ('00000000-0000-0000-0000-000000000102', 'Ghana', 'GH', 'country', '00000000-0000-0000-0000-000000000010'),
    ('00000000-0000-0000-0000-000000000103', 'Senegal', 'SN', 'country', '00000000-0000-0000-0000-000000000010'),
    ('00000000-0000-0000-0000-000000000104', 'Cote d''Ivoire', 'CI', 'country', '00000000-0000-0000-0000-000000000010'),
    ('00000000-0000-0000-0000-000000000105', 'Mali', 'ML', 'country', '00000000-0000-0000-0000-000000000010'),
    -- EAC countries
    ('00000000-0000-0000-0000-000000000110', 'Kenya', 'KE', 'country', '00000000-0000-0000-0000-000000000011'),
    ('00000000-0000-0000-0000-000000000111', 'Tanzania', 'TZ', 'country', '00000000-0000-0000-0000-000000000011'),
    ('00000000-0000-0000-0000-000000000112', 'Uganda', 'UG', 'country', '00000000-0000-0000-0000-000000000011'),
    ('00000000-0000-0000-0000-000000000113', 'Rwanda', 'RW', 'country', '00000000-0000-0000-0000-000000000011'),
    ('00000000-0000-0000-0000-000000000114', 'Ethiopia', 'ET', 'country', '00000000-0000-0000-0000-000000000011'),
    -- SADC countries
    ('00000000-0000-0000-0000-000000000120', 'South Africa', 'ZA', 'country', '00000000-0000-0000-0000-000000000012'),
    ('00000000-0000-0000-0000-000000000121', 'Mozambique', 'MZ', 'country', '00000000-0000-0000-0000-000000000012'),
    ('00000000-0000-0000-0000-000000000122', 'Zimbabwe', 'ZW', 'country', '00000000-0000-0000-0000-000000000012'),
    ('00000000-0000-0000-0000-000000000123', 'Zambia', 'ZM', 'country', '00000000-0000-0000-0000-000000000012'),
    -- IGAD countries
    ('00000000-0000-0000-0000-000000000130', 'Somalia', 'SO', 'country', '00000000-0000-0000-0000-000000000013'),
    ('00000000-0000-0000-0000-000000000131', 'Sudan', 'SD', 'country', '00000000-0000-0000-0000-000000000013'),
    ('00000000-0000-0000-0000-000000000132', 'Djibouti', 'DJ', 'country', '00000000-0000-0000-0000-000000000013'),
    -- ECCAS countries
    ('00000000-0000-0000-0000-000000000140', 'Cameroon', 'CM', 'country', '00000000-0000-0000-0000-000000000014'),
    ('00000000-0000-0000-0000-000000000141', 'DRC', 'CD', 'country', '00000000-0000-0000-0000-000000000014'),
    ('00000000-0000-0000-0000-000000000142', 'Chad', 'TD', 'country', '00000000-0000-0000-0000-000000000014'),
    -- UMA countries
    ('00000000-0000-0000-0000-000000000150', 'Morocco', 'MA', 'country', '00000000-0000-0000-0000-000000000015'),
    ('00000000-0000-0000-0000-000000000151', 'Tunisia', 'TN', 'country', '00000000-0000-0000-0000-000000000015'),
    ('00000000-0000-0000-0000-000000000152', 'Algeria', 'DZ', 'country', '00000000-0000-0000-0000-000000000015')
ON CONFLICT (code) DO NOTHING;
"

TENANT_COUNT=$(exec_sql_quiet "SELECT COUNT(*) FROM academy_core.tenants;")
echo "  Tenants in database: $TENANT_COUNT"

# ---------------------------------------------------------------------------
# Production mode stops here
# ---------------------------------------------------------------------------
if [ "$PRODUCTION_MODE" = true ]; then
    echo ""
    echo "=============================================="
    echo " Reference data seeded (production mode)"
    echo "=============================================="
    echo ""
    echo "  Tenants: $TENANT_COUNT"
    echo ""
    echo "Next steps:"
    echo "  1. Create the super-admin: ./infra/scripts/init-admin.sh"
    echo "  2. Create courses via the admin UI"
    exit 0
fi

# ============================================================================
# PHASE 2: Demo Users
# ============================================================================
echo ""
echo "[2/4] Inserting demo users..."

exec_sql "
SET search_path TO academy_core, public;

INSERT INTO users (id, email, first_name, last_name, role, tenant_id, preferred_language) VALUES
    -- Continental admins
    ('00000000-0000-0000-0000-000000000201', 'serge@topnet-solutions.com', 'Serge', 'Admin', 'admin_continental', '00000000-0000-0000-0000-000000000001', 'fr'),
    -- Trainers
    ('00000000-0000-0000-0000-000000000202', 'amina.osei@topnet-solutions.com', 'Amina', 'Osei', 'trainer', '00000000-0000-0000-0000-000000000001', 'en'),
    ('00000000-0000-0000-0000-000000000203', 'jean.baptiste@eac.int', 'Jean-Baptiste', 'Nkurunziza', 'trainer', '00000000-0000-0000-0000-000000000011', 'fr'),
    ('00000000-0000-0000-0000-000000000204', 'fatima.diallo@ecowas.int', 'Fatima', 'Diallo', 'trainer', '00000000-0000-0000-0000-000000000010', 'fr'),
    -- REC admins
    ('00000000-0000-0000-0000-000000000210', 'admin@eac.int', 'Joseph', 'Mugisha', 'admin_rec', '00000000-0000-0000-0000-000000000011', 'en'),
    ('00000000-0000-0000-0000-000000000211', 'admin@ecowas.int', 'Ousmane', 'Traore', 'admin_rec', '00000000-0000-0000-0000-000000000010', 'fr'),
    ('00000000-0000-0000-0000-000000000212', 'admin@sadc.int', 'Thabo', 'Mokoena', 'admin_rec', '00000000-0000-0000-0000-000000000012', 'en'),
    -- Country admins
    ('00000000-0000-0000-0000-000000000220', 'admin@dvs.go.ke', 'Wanjiku', 'Mwangi', 'admin_country', '00000000-0000-0000-0000-000000000110', 'en'),
    ('00000000-0000-0000-0000-000000000221', 'admin@nahdic.gov.ng', 'Chinedu', 'Okafor', 'admin_country', '00000000-0000-0000-0000-000000000101', 'en'),
    -- Learners
    ('00000000-0000-0000-0000-000000000230', 'wanjiku.k@dvs.go.ke', 'Wanjiku', 'Kamau', 'learner', '00000000-0000-0000-0000-000000000110', 'en'),
    ('00000000-0000-0000-0000-000000000231', 'omar.h@livestock.gov.so', 'Omar', 'Hassan', 'learner', '00000000-0000-0000-0000-000000000130', 'ar'),
    ('00000000-0000-0000-0000-000000000232', 'marie.n@minagri.gov.rw', 'Marie', 'Niyonzima', 'learner', '00000000-0000-0000-0000-000000000113', 'fr'),
    ('00000000-0000-0000-0000-000000000233', 'abdou.s@elevage.gov.sn', 'Abdou', 'Sall', 'learner', '00000000-0000-0000-0000-000000000103', 'fr'),
    ('00000000-0000-0000-0000-000000000234', 'sipho.d@daff.gov.za', 'Sipho', 'Dlamini', 'learner', '00000000-0000-0000-0000-000000000120', 'en'),
    ('00000000-0000-0000-0000-000000000235', 'hassan.b@onssa.gov.ma', 'Hassan', 'Benali', 'learner', '00000000-0000-0000-0000-000000000150', 'ar')
ON CONFLICT (email) DO NOTHING;
"

USER_COUNT=$(exec_sql_quiet "SELECT COUNT(*) FROM academy_core.users;")
echo "  Users in database: $USER_COUNT"

# ============================================================================
# PHASE 3: Demo Courses, Modules, Assessments
# ============================================================================
echo ""
echo "[3/4] Inserting demo courses and modules..."

exec_sql "
SET search_path TO academy_core, public;

-- Courses
INSERT INTO courses (id, tenant_id, tenant_level, title, description, slug, level, status, estimated_hours, passing_score, published_at) VALUES
    ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'continental',
        '{\"fr\":\"Surveillance epidemiologique\",\"en\":\"Epidemiological Surveillance\",\"ar\":\"المراقبة الوبائية\",\"pt\":\"Vigilancia Epidemiologica\"}',
        '{\"fr\":\"Maitrisez les fondamentaux de la surveillance epidemiologique animale avec ARIS\"}',
        'surveillance-epidemiologique', 'beginner', 'published', 12, 70, NOW()),
    ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'continental',
        '{\"fr\":\"Collecte de donnees terrain\",\"en\":\"Field Data Collection\",\"ar\":\"جمع البيانات الميدانية\",\"pt\":\"Coleta de Dados de Campo\"}',
        '{\"fr\":\"Apprenez a utiliser ARIS pour la collecte terrain, y compris le mode offline\"}',
        'collecte-donnees-terrain', 'intermediate', 'published', 24, 75, NOW()),
    ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', 'continental',
        '{\"fr\":\"Analyse & Rapports ARIS\",\"en\":\"ARIS Analysis & Reports\",\"ar\":\"تحليل وتقارير ARIS\",\"pt\":\"Analise e Relatorios ARIS\"}',
        '{\"fr\":\"Creez des tableaux de bord et rapports avances avec les outils analytiques ARIS\"}',
        'analyse-rapports', 'advanced', 'published', 36, 80, NOW()),
    ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', 'continental',
        '{\"fr\":\"Administration systeme ARIS\",\"en\":\"ARIS System Administration\",\"ar\":\"إدارة نظام ARIS\",\"pt\":\"Administracao do Sistema ARIS\"}',
        '{\"fr\":\"Devenez expert en administration, configuration et maintenance de la plateforme ARIS\"}',
        'administration-systeme', 'expert', 'published', 48, 85, NOW()),
    ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', 'continental',
        '{\"fr\":\"Gestion des formulaires\",\"en\":\"Form Management\",\"ar\":\"إدارة النماذج\",\"pt\":\"Gestao de Formularios\"}',
        '{\"fr\":\"Concevez et deployez des formulaires de collecte avec le FormBuilder ARIS\"}',
        'gestion-formulaires', 'intermediate', 'published', 18, 75, NOW()),
    ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001', 'continental',
        '{\"fr\":\"Interoperabilite DHIS2/FHIR\",\"en\":\"DHIS2/FHIR Interoperability\",\"ar\":\"التشغيل البيني DHIS2/FHIR\",\"pt\":\"Interoperabilidade DHIS2/FHIR\"}',
        '{\"fr\":\"Configurez les echanges de donnees entre ARIS et les systemes internationaux\"}',
        'interoperabilite-dhis2-fhir', 'advanced', 'published', 32, 80, NOW())
ON CONFLICT (slug) DO NOTHING;

-- Modules for first course
INSERT INTO modules (id, course_id, title, sort_order, estimated_minutes) VALUES
    ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Introduction a la surveillance\",\"en\":\"Introduction to Surveillance\"}', 1, 45),
    ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Types de maladies animales\",\"en\":\"Types of Animal Diseases\"}', 2, 60),
    ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Protocoles de declaration\",\"en\":\"Reporting Protocols\"}', 3, 90),
    ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Utilisation d ARIS pour la surveillance\",\"en\":\"Using ARIS for Surveillance\"}', 4, 120),
    ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Cas pratiques terrain\",\"en\":\"Field Case Studies\"}', 5, 90),
    ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Evaluation intermediaire\",\"en\":\"Mid-term Assessment\"}', 6, 45),
    ('00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Projet de surveillance\",\"en\":\"Surveillance Project\"}', 7, 120),
    ('00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000301', '{\"fr\":\"Examen final\",\"en\":\"Final Exam\"}', 8, 60)
ON CONFLICT (id) DO NOTHING;

-- Assessments
INSERT INTO assessments (id, course_id, title, type, level, passing_score, time_limit_minutes, max_attempts, is_final) VALUES
    ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000301',
        '{\"fr\":\"Quiz - Introduction surveillance\",\"en\":\"Quiz - Surveillance Introduction\"}',
        'qcm', 'beginner', 70, 30, 3, false),
    ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000301',
        '{\"fr\":\"Examen final - Surveillance\",\"en\":\"Final Exam - Surveillance\"}',
        'mixed', 'beginner', 70, 90, 2, true),
    ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000302',
        '{\"fr\":\"Evaluation - Collecte terrain\",\"en\":\"Assessment - Field Data Collection\"}',
        'practical', 'intermediate', 75, 120, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Sample questions for first assessment
INSERT INTO questions (id, assessment_id, question_text, question_type, options, difficulty, points) VALUES
    ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000501',
        '{\"fr\":\"Quel est le principal objectif de la surveillance epidemiologique ?\",\"en\":\"What is the primary objective of epidemiological surveillance?\"}',
        'single_choice',
        '[{\"text\":{\"fr\":\"Detecter les maladies precocement\",\"en\":\"Early disease detection\"},\"is_correct\":true},{\"text\":{\"fr\":\"Vendre des medicaments\",\"en\":\"Sell medication\"},\"is_correct\":false},{\"text\":{\"fr\":\"Compter les animaux\",\"en\":\"Count animals\"},\"is_correct\":false}]',
        1, 2),
    ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000501',
        '{\"fr\":\"Quelles sont les composantes cles d un systeme de surveillance ?\",\"en\":\"What are the key components of a surveillance system?\"}',
        'multiple_choice',
        '[{\"text\":{\"fr\":\"Collecte de donnees\",\"en\":\"Data collection\"},\"is_correct\":true},{\"text\":{\"fr\":\"Analyse\",\"en\":\"Analysis\"},\"is_correct\":true},{\"text\":{\"fr\":\"Diffusion\",\"en\":\"Dissemination\"},\"is_correct\":true},{\"text\":{\"fr\":\"Marketing\",\"en\":\"Marketing\"},\"is_correct\":false}]',
        2, 3)
ON CONFLICT (id) DO NOTHING;
"

COURSE_COUNT=$(exec_sql_quiet "SELECT COUNT(*) FROM academy_core.courses;")
MODULE_COUNT=$(exec_sql_quiet "SELECT COUNT(*) FROM academy_core.modules;")
echo "  Courses: $COURSE_COUNT"
echo "  Modules: $MODULE_COUNT"

# ============================================================================
# PHASE 4: Demo Enrollments, Certifications, Live Sessions
# ============================================================================
echo ""
echo "[4/4] Inserting demo enrollments, certifications, and live sessions..."

exec_sql "
SET search_path TO academy_core, public;

-- Enrollments
INSERT INTO enrollments (user_id, course_id, status, progress_percent, current_level) VALUES
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 'completed', 100, 'beginner'),
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302', 'active', 67, 'intermediate'),
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000305', 'active', 82, 'intermediate'),
    ('00000000-0000-0000-0000-000000000230', '00000000-0000-0000-0000-000000000301', 'active', 45, 'beginner'),
    ('00000000-0000-0000-0000-000000000231', '00000000-0000-0000-0000-000000000301', 'active', 20, 'beginner'),
    ('00000000-0000-0000-0000-000000000232', '00000000-0000-0000-0000-000000000302', 'active', 55, 'intermediate'),
    ('00000000-0000-0000-0000-000000000233', '00000000-0000-0000-0000-000000000301', 'completed', 100, 'beginner'),
    ('00000000-0000-0000-0000-000000000234', '00000000-0000-0000-0000-000000000303', 'active', 30, 'advanced'),
    ('00000000-0000-0000-0000-000000000235', '00000000-0000-0000-0000-000000000305', 'active', 10, 'intermediate')
ON CONFLICT (user_id, course_id) DO NOTHING;

-- Certifications
INSERT INTO certifications (user_id, course_id, level, status, certificate_number, issued_at, expires_at) VALUES
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 'beginner', 'issued', 'ARIS-CERT-2026-00001', '2026-01-15T10:00:00Z', '2029-01-15T10:00:00Z'),
    ('00000000-0000-0000-0000-000000000233', '00000000-0000-0000-0000-000000000301', 'beginner', 'issued', 'ARIS-CERT-2026-00002', '2026-02-20T14:00:00Z', '2029-02-20T14:00:00Z')
ON CONFLICT (certificate_number) DO NOTHING;

-- Live sessions
INSERT INTO live_sessions (id, course_id, title, trainer_id, tenant_id, status, scheduled_at, duration_minutes) VALUES
    ('00000000-0000-0000-0000-000000000701',
        '00000000-0000-0000-0000-000000000303',
        '{\"fr\":\"Maitriser les dashboards ARIS\",\"en\":\"Mastering ARIS Dashboards\"}',
        '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'scheduled', NOW() + INTERVAL '2 days', 90),
    ('00000000-0000-0000-0000-000000000702',
        '00000000-0000-0000-0000-000000000302',
        '{\"fr\":\"Collecte offline en zones blanches\",\"en\":\"Offline Collection in Blank Zones\"}',
        '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', 'scheduled', NOW() + INTERVAL '3 days', 60),
    ('00000000-0000-0000-0000-000000000703',
        '00000000-0000-0000-0000-000000000304',
        '{\"fr\":\"Certification Expert — Soutenance Q&A\",\"en\":\"Expert Certification — Defense Q&A\"}',
        '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', 'scheduled', NOW() + INTERVAL '7 days', 120)
ON CONFLICT (id) DO NOTHING;
"

ENROLLMENT_COUNT=$(exec_sql_quiet "SELECT COUNT(*) FROM academy_core.enrollments;")
CERT_COUNT=$(exec_sql_quiet "SELECT COUNT(*) FROM academy_core.certifications;")
LIVE_COUNT=$(exec_sql_quiet "SELECT COUNT(*) FROM academy_core.live_sessions;")
echo "  Enrollments: $ENROLLMENT_COUNT"
echo "  Certifications: $CERT_COUNT"
echo "  Live sessions: $LIVE_COUNT"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "=============================================="
echo " Seed data complete (development mode)"
echo "=============================================="
echo ""
echo "  Tenants       : $TENANT_COUNT"
echo "  Users         : $USER_COUNT"
echo "  Courses       : $COURSE_COUNT"
echo "  Modules       : $MODULE_COUNT"
echo "  Enrollments   : $ENROLLMENT_COUNT"
echo "  Certifications: $CERT_COUNT"
echo "  Live sessions : $LIVE_COUNT"
echo ""
echo "Demo admin login: serge@topnet-solutions.com (no password set — use init-admin.sh)"
echo ""

exit 0
