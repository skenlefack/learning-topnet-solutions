// ============================================================================
// ARIS Academy — Course Override Resolver
// Resolves: Continental base → REC override → Country override (cascade merge)
// Caches resolved courses in Redis with 5-min TTL
// ============================================================================
import {
  query,
  queryOne,
  cacheGet,
  cacheSet,
  cacheDel,
  type SupportedLanguage,
} from '@aris-academy/shared';

const CACHE_TTL = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Resolved course shape (base + merged overrides + extracted lang string)
// ---------------------------------------------------------------------------
export interface ResolvedCourse {
  id: string;
  tenantId: string;
  tenantLevel: string;
  title: Record<string, string>;
  description: Record<string, string>;
  resolvedTitle: string;
  resolvedDescription: string;
  slug: string;
  level: string;
  status: string;
  thumbnailUrl: string | null;
  estimatedHours: number | null;
  passingScore: number;
  prerequisites: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  modules: ResolvedModule[] | null;
  appliedOverrides: string[]; // tenant_levels that contributed
}

interface ResolvedModule {
  id: string;
  title: Record<string, string>;
  description: Record<string, string> | null;
  sortOrder: number;
  estimatedMinutes: number | null;
  isRequired: boolean;
  lessons: ResolvedLesson[] | null;
}

interface ResolvedLesson {
  id: string;
  title: Record<string, string>;
  type: string;
  sortOrder: number;
  durationMinutes: number | null;
  isRequired: boolean;
}

// ---------------------------------------------------------------------------
// Deep-merge helper: right values overwrite left, skipping null/undefined
// ---------------------------------------------------------------------------
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result = { ...base };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const val = override[key];
    if (val === null || val === undefined) continue;
    if (
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Resolve a single course with the full override cascade
// ---------------------------------------------------------------------------
export async function resolveCourse(
  courseId: string,
  tenantId: string,
  lang: SupportedLanguage = 'fr',
): Promise<ResolvedCourse | null> {
  // 1. Check cache
  const cacheKey = `resolved:${courseId}:${tenantId}:${lang}`;
  const cached = await cacheGet<ResolvedCourse>(cacheKey);
  if (cached) return cached;

  // 2. Load base course + modules + lessons
  const base = await queryOne<Record<string, unknown>>(
    `SELECT c.*,
       json_agg(
         json_build_object(
           'id', m.id, 'title', m.title, 'description', m.description,
           'sortOrder', m.sort_order, 'estimatedMinutes', m.estimated_minutes,
           'isRequired', m.is_required
         ) ORDER BY m.sort_order
       ) FILTER (WHERE m.id IS NOT NULL) AS modules
     FROM academy_core.courses c
     LEFT JOIN academy_core.modules m ON m.course_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [courseId],
  );

  if (!base) return null;

  // 3. Load the tenant hierarchy to know which overrides apply
  //    Walk up: tenant → parent (REC) → parent (Continental)
  const tenantChain = await query<{ id: string; level: string; parent_id: string | null }>(
    `WITH RECURSIVE chain AS (
       SELECT id, level, parent_id FROM academy_core.tenants WHERE id = $1
       UNION ALL
       SELECT t.id, t.level, t.parent_id
       FROM academy_core.tenants t JOIN chain c ON t.id = c.parent_id
     )
     SELECT * FROM chain`,
    [tenantId],
  );

  const tenantIds = tenantChain.map((t) => t.id);

  // 4. Load all overrides that match the tenant chain
  const overrides = await query<{
    tenant_level: string;
    override_data: Record<string, unknown>;
  }>(
    `SELECT tenant_level, override_data
     FROM academy_core.course_overrides
     WHERE course_id = $1 AND tenant_id = ANY($2)
     ORDER BY CASE tenant_level
       WHEN 'continental' THEN 1
       WHEN 'rec' THEN 2
       WHEN 'country' THEN 3
     END`,
    [courseId, tenantIds],
  );

  // 5. Cascade merge: Continental (base) → REC override → Country override
  let merged: Record<string, unknown> = {
    title: base.title,
    description: base.description,
  };
  const appliedOverrides: string[] = [];

  for (const ov of overrides) {
    merged = deepMerge(merged, ov.override_data);
    appliedOverrides.push(ov.tenant_level);
  }

  const title = (merged.title ?? base.title) as Record<string, string>;
  const description = (merged.description ?? base.description ?? {}) as Record<string, string>;

  // 6. Load lessons for each module
  let modules: ResolvedModule[] | null = null;
  if (Array.isArray(base.modules)) {
    const moduleIds = (base.modules as Array<{ id: string }>).map((m) => m.id);
    const lessons =
      moduleIds.length > 0
        ? await query<Record<string, unknown>>(
            `SELECT id, module_id, title, type, sort_order, duration_minutes, is_required
             FROM academy_core.lessons
             WHERE module_id = ANY($1)
             ORDER BY sort_order`,
            [moduleIds],
          )
        : [];

    const lessonsByModule = new Map<string, ResolvedLesson[]>();
    for (const l of lessons) {
      const mid = l.module_id as string;
      if (!lessonsByModule.has(mid)) lessonsByModule.set(mid, []);
      lessonsByModule.get(mid)!.push({
        id: l.id as string,
        title: l.title as Record<string, string>,
        type: l.type as string,
        sortOrder: l.sort_order as number,
        durationMinutes: l.duration_minutes as number | null,
        isRequired: l.is_required as boolean,
      });
    }

    modules = (base.modules as Array<Record<string, unknown>>).map((m) => ({
      id: m.id as string,
      title: m.title as Record<string, string>,
      description: (m.description ?? null) as Record<string, string> | null,
      sortOrder: m.sortOrder as number,
      estimatedMinutes: (m.estimatedMinutes ?? null) as number | null,
      isRequired: m.isRequired as boolean,
      lessons: lessonsByModule.get(m.id as string) ?? null,
    }));
  }

  // 7. Build resolved object
  const resolved: ResolvedCourse = {
    id: base.id as string,
    tenantId: base.tenant_id as string,
    tenantLevel: base.tenant_level as string,
    title,
    description,
    resolvedTitle: title[lang] || title.fr || title.en || '',
    resolvedDescription: description[lang] || description.fr || description.en || '',
    slug: base.slug as string,
    level: base.level as string,
    status: base.status as string,
    thumbnailUrl: (base.thumbnail_url ?? null) as string | null,
    estimatedHours: (base.estimated_hours ?? null) as number | null,
    passingScore: base.passing_score as number,
    prerequisites: (base.prerequisites ?? []) as string[],
    tags: (base.tags ?? []) as string[],
    metadata: (base.metadata ?? {}) as Record<string, unknown>,
    createdBy: (base.created_by ?? null) as string | null,
    publishedAt: (base.published_at ?? null) as string | null,
    createdAt: base.created_at as string,
    updatedAt: base.updated_at as string,
    modules,
    appliedOverrides,
  };

  // 8. Cache it
  await cacheSet(cacheKey, resolved, CACHE_TTL);

  return resolved;
}

// ---------------------------------------------------------------------------
// Invalidate resolved cache for a given course
// ---------------------------------------------------------------------------
export async function invalidateResolvedCache(courseId: string): Promise<void> {
  await cacheDel(`resolved:${courseId}:*`);
}
