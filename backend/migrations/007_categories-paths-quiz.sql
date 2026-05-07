-- ============================================================================
-- Migration 007: Course Categories, Learning Paths, Assessment linking
-- Adds category system, multi-course learning paths, and assessment-to-lesson linking
-- ============================================================================

SET search_path TO academy_core, public;

-- ============================================================================
-- COURSE CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name JSONB NOT NULL,
    description JSONB,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50) DEFAULT 'BookOpen',
    color VARCHAR(7) DEFAULT '#1A5632',
    sort_order INTEGER DEFAULT 0,
    parent_id UUID REFERENCES course_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON course_categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON course_categories(parent_id);

-- Link courses to categories
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES course_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);

-- ============================================================================
-- LEARNING PATHS (Parcours de formation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    title JSONB NOT NULL,
    description JSONB,
    slug VARCHAR(255) UNIQUE NOT NULL,
    estimated_hours DECIMAL(5,1),
    passing_score INTEGER DEFAULT 70,
    thumbnail_url TEXT,
    is_published BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paths_slug ON learning_paths(slug);
CREATE INDEX IF NOT EXISTS idx_paths_tenant ON learning_paths(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paths_published ON learning_paths(is_published);

-- Courses in a learning path (ordered)
CREATE TABLE IF NOT EXISTS learning_path_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    UNIQUE(path_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_lpc_path ON learning_path_courses(path_id);
CREATE INDEX IF NOT EXISTS idx_lpc_course ON learning_path_courses(course_id);

-- Enrollments in learning paths
CREATE TABLE IF NOT EXISTS learning_path_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    path_id UUID NOT NULL REFERENCES learning_paths(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    progress_percent DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, path_id)
);

CREATE INDEX IF NOT EXISTS idx_lpe_user ON learning_path_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_lpe_path ON learning_path_enrollments(path_id);

-- ============================================================================
-- ASSESSMENT LINKING (to lessons and modules)
-- ============================================================================

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_lesson ON assessments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assessments_module ON assessments(module_id);

-- ============================================================================
-- RLS for new tables
-- ============================================================================

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY paths_select ON learning_paths FOR SELECT USING (is_tenant_visible(tenant_id));
CREATE POLICY paths_insert ON learning_paths FOR INSERT WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY paths_update ON learning_paths FOR UPDATE USING (current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND is_tenant_visible(tenant_id)));
CREATE POLICY paths_delete ON learning_paths FOR DELETE USING (current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND is_tenant_visible(tenant_id)));

CREATE POLICY lpc_select ON learning_path_courses FOR SELECT USING (true);
CREATE POLICY lpc_insert ON learning_path_courses FOR INSERT WITH CHECK (true);
CREATE POLICY lpc_delete ON learning_path_courses FOR DELETE USING (true);

CREATE POLICY lpe_select ON learning_path_enrollments FOR SELECT USING (current_tenant_id() IS NULL OR user_id = current_user_id());
CREATE POLICY lpe_insert ON learning_path_enrollments FOR INSERT WITH CHECK (current_tenant_id() IS NULL OR user_id = current_user_id());
CREATE POLICY lpe_update ON learning_path_enrollments FOR UPDATE USING (current_tenant_id() IS NULL OR user_id = current_user_id());

-- ============================================================================
-- SEED: Default categories
-- ============================================================================

INSERT INTO course_categories (name, description, slug, icon, color, sort_order) VALUES
  ('{"fr":"Santé animale","en":"Animal Health","ar":"صحة الحيوان","pt":"Saúde animal"}', '{"fr":"Surveillance, diagnostic et contrôle des maladies animales","en":"Animal disease surveillance, diagnosis and control"}', 'sante-animale', 'ShieldCheck', '#1A5632', 1),
  ('{"fr":"Épidémiologie","en":"Epidemiology","ar":"علم الأوبئة","pt":"Epidemiologia"}', '{"fr":"Méthodes épidémiologiques et systèmes de surveillance","en":"Epidemiological methods and surveillance systems"}', 'epidemiologie', 'Microscope', '#930e2d', 2),
  ('{"fr":"Production animale","en":"Animal Production","ar":"الإنتاج الحيواني","pt":"Produção animal"}', '{"fr":"Systèmes d''élevage, nutrition et amélioration génétique","en":"Livestock systems, nutrition and genetic improvement"}', 'production-animale', 'Beef', '#B8952E', 3),
  ('{"fr":"Pêche & Aquaculture","en":"Fisheries & Aquaculture","ar":"المصايد وتربية الأحياء المائية","pt":"Pescas e Aquicultura"}', '{"fr":"Gestion durable des ressources halieutiques","en":"Sustainable fisheries resource management"}', 'peche-aquaculture', 'Fish', '#0e591a', 4),
  ('{"fr":"Commerce & Normes SPS","en":"Trade & SPS Standards","ar":"التجارة ومعايير SPS","pt":"Comércio e Normas SPS"}', '{"fr":"Normes sanitaires, certification export, ZLECAf","en":"Sanitary standards, export certification, AfCFTA"}', 'commerce-sps', 'TrendingUp', '#154528', 5),
  ('{"fr":"Bien-être animal","en":"Animal Welfare","ar":"رفاهية الحيوان","pt":"Bem-estar animal"}', '{"fr":"Standards et réglementation du bien-être animal","en":"Animal welfare standards and regulations"}', 'bien-etre-animal', 'Heart', '#930e2d', 6),
  ('{"fr":"Ressources génétiques","en":"Genetic Resources","ar":"الموارد الوراثية","pt":"Recursos genéticos"}', '{"fr":"Conservation et caractérisation des races africaines","en":"Conservation and characterization of African breeds"}', 'ressources-genetiques', 'Boxes', '#1A5632', 7),
  ('{"fr":"Apiculture","en":"Beekeeping","ar":"تربية النحل","pt":"Apicultura"}', '{"fr":"Techniques apicoles et santé des abeilles","en":"Beekeeping techniques and bee health"}', 'apiculture', 'Bug', '#B8952E', 8),
  ('{"fr":"Environnement","en":"Environment","ar":"البيئة","pt":"Ambiente"}', '{"fr":"Impact environnemental et développement durable","en":"Environmental impact and sustainable development"}', 'environnement', 'Leaf', '#0e591a', 9)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- UPDATE_AT triggers for new tables
-- ============================================================================

CREATE TRIGGER trg_course_categories_updated_at BEFORE UPDATE ON course_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_learning_paths_updated_at BEFORE UPDATE ON learning_paths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_learning_path_enrollments_updated_at BEFORE UPDATE ON learning_path_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
