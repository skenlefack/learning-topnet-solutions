#!/usr/bin/env node
// ============================================================================
// Fix AFAData course translations — unwrap nested {"text":"..."} from SYSTRAN
// ============================================================================
const API_URL = 'http://10.202.101.144';
const COURSE_ID = 'ef9a3436-a914-4264-9ec2-c69250eafd92';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function login() {
  const res = await fetch(`${API_URL}/api/learning/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'serge@au-ibar.org', password: 'academy2026' }),
  });
  return (await res.json()).token;
}

// Recursively unwrap {"text":"..."} nesting
function unwrapText(val) {
  if (typeof val !== 'string') return val;
  let result = val;
  let maxIterations = 5;
  while (maxIterations-- > 0 && typeof result === 'string' && result.startsWith('{')) {
    try {
      const parsed = JSON.parse(result);
      if (parsed.text !== undefined) {
        result = parsed.text;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return result;
}

function fixMultiLang(title) {
  if (!title || typeof title !== 'object') return title;
  const fixed = {};
  let changed = false;
  for (const [lang, val] of Object.entries(title)) {
    const unwrapped = unwrapText(val);
    fixed[lang] = unwrapped;
    if (unwrapped !== val) changed = true;
  }
  return { fixed, changed };
}

async function apiPut(token, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`  FAIL PUT ${path}: ${res.status} ${err.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function main() {
  const token = await login();
  console.log('Logged in\n');

  // 1. Fix course title & description
  console.log('--- Fixing course ---');
  const courseRes = await fetch(`${API_URL}/api/courses/${COURSE_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const course = (await courseRes.json()).data;

  const titleFix = fixMultiLang(course.title);
  const descFix = fixMultiLang(course.description);

  if (titleFix.changed || descFix.changed) {
    console.log('  Title:', JSON.stringify(titleFix.fixed));
    console.log('  Desc:', JSON.stringify(descFix.fixed));
    await apiPut(token, `/api/courses/${COURSE_ID}`, {
      title: titleFix.fixed,
      description: descFix.fixed,
    });
    console.log('  OK Course fixed');
  } else {
    console.log('  Course OK (no fix needed)');
  }

  // 2. Fix modules & lessons
  console.log('\n--- Fixing modules & lessons ---');
  const modsRes = await fetch(`${API_URL}/api/courses/modules/course/${COURSE_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const modules = (await modsRes.json()).data || [];

  let fixCount = 0;
  for (const mod of modules) {
    const modTitleFix = fixMultiLang(mod.title);
    if (modTitleFix.changed) {
      process.stdout.write(`  Module "${(mod.title.fr || '').slice(0, 40)}": `);
      await apiPut(token, `/api/courses/modules/${mod.id}`, { title: modTitleFix.fixed });
      console.log('FIXED');
      fixCount++;
    }

    // Fix lessons
    for (const lesson of (mod.lessons || [])) {
      const lessonTitleFix = fixMultiLang(lesson.title);
      if (lessonTitleFix.changed) {
        process.stdout.write(`    Lesson "${(lesson.title.fr || '').slice(0, 40)}": `);
        await apiPut(token, `/api/courses/lessons/${lesson.id}`, { title: lessonTitleFix.fixed });
        console.log('FIXED');
        fixCount++;
      }
    }
  }

  console.log(`\nDone! Fixed ${fixCount} items.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
