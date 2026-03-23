/**
 * One-time script: backfill topic_id for homework files that are missing it.
 *
 * For each attached_file with category='homework' and topic_id=null:
 * 1. Look up the student's learning path topics
 * 2. Extract topic portion from filename (strip dz_ prefix + student name)
 * 3. Transliterate to Cyrillic and match against LP topics
 * 4. If matched, update the file's topic_id
 *
 * Run: npx tsx scripts/fix-homework-topic-ids.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  // Fallback: try from cwd
  dotenv.config({ path: resolve(process.cwd(), '../../.env') });
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or key in .env');
  console.error('Looked at:', envPath);
  console.error('SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('Key:', supabaseKey ? 'set' : 'missing');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

// --- Latin → Cyrillic transliteration ---

const LAT_TO_CYR: Record<string, string> = {
  'shch': 'щ', 'sch': 'щ',
  'yo': 'ё', 'zh': 'ж', 'ch': 'ч', 'sh': 'ш', 'kh': 'х',
  'yu': 'ю', 'ya': 'я', 'ts': 'ц', 'ey': 'ей',
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д',
  'e': 'е', 'z': 'з', 'i': 'и', 'y': 'ы',
  'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
  'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у',
  'f': 'ф', 'h': 'х', 'j': 'й', 'x': 'кс',
};

function transliterate(latin: string): string {
  let result = '';
  let i = 0;
  const lower = latin.toLowerCase();
  while (i < lower.length) {
    let matched = false;
    for (const len of [4, 3, 2, 1]) {
      const chunk = lower.substring(i, i + len);
      if (LAT_TO_CYR[chunk]) {
        result += LAT_TO_CYR[chunk];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += lower[i];
      i++;
    }
  }
  return result;
}

function extractTopicFromFilename(filename: string, studentName?: string): string {
  let base = filename.replace(/\.[^.]+$/, '').toLowerCase();
  base = base.replace(/^(dz|homework|plan|material|test|lesson|notes|solution)_/i, '');
  const parts = base.split(/[_\-]+/).filter((p) => p.length >= 2);
  if (parts.length === 0) return transliterate(base);

  let topicStartIdx = 0;
  if (studentName) {
    const nameWords = studentName.toLowerCase().split(/\s+/);
    for (let n = Math.min(nameWords.length, parts.length); n >= 1; n--) {
      const candidateCyr = parts.slice(0, n).map((p) => transliterate(p));
      const allMatch = candidateCyr.every((cp) =>
        nameWords.some((nw) => nw.includes(cp) || cp.includes(nw))
      );
      if (allMatch && parts.length > n) {
        topicStartIdx = n;
        break;
      }
    }
  }

  const topicParts = parts.slice(topicStartIdx);
  if (topicParts.length === 0) return parts.map((p) => transliterate(p)).join(' ');
  return topicParts.map((p) => transliterate(p)).join(' ');
}

function findMatchingTopic(
  searchStr: string,
  topics: Array<{ id: string; title: string }>,
): { id: string; title: string } | undefined {
  const lower = searchStr.toLowerCase();

  // 1. Exact match
  const exact = topics.find((t) => t.title.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Substring
  const substring = topics.find((t) => {
    const tLower = t.title.toLowerCase();
    return tLower.includes(lower) || lower.includes(tLower);
  });
  if (substring) return substring;

  // 3. Keyword overlap >= 50%
  const words = lower.split(/[\s,.:;—–\-/]+/).filter((w) => w.length > 2);
  if (words.length === 0) return undefined;

  let bestMatch: { id: string; title: string } | undefined;
  let bestScore = 0;
  for (const t of topics) {
    const tWords = t.title.toLowerCase().split(/[\s,.:;—–\-/]+/).filter((w) => w.length > 2);
    if (tWords.length === 0) continue;
    const overlap = words.filter((w) => tWords.some((tw) => tw.includes(w) || w.includes(tw))).length;
    const score = overlap / Math.min(words.length, tWords.length);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = t;
    }
  }
  return bestMatch;
}

async function main() {
  // 1. Get all homework files without topic_id
  const { data: files, error: filesErr } = await sb
    .from('attached_files')
    .select('*')
    .eq('category', 'homework')
    .is('topic_id', null);

  if (filesErr) {
    console.error('Failed to fetch files:', filesErr);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('No homework files without topic_id found. Nothing to fix.');
    return;
  }

  console.log(`Found ${files.length} homework file(s) without topic_id:\n`);

  // Cache LP topics and student names by student_id
  const lpCache = new Map<string, Array<{ id: string; title: string }>>();
  const nameCache = new Map<string, string>();

  // Pre-load all student names
  const { data: students } = await sb.from('students').select('id, name');
  if (students) {
    for (const s of students) nameCache.set(s.id, s.name);
  }

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const studentId = file.entity_id;
    const filename = file.filename;
    const studentName = studentId ? nameCache.get(studentId) ?? '' : '';
    console.log(`--- File: ${filename} (student: ${studentName || studentId})`);

    if (!studentId) {
      console.log('  SKIP: no entity_id');
      skipped++;
      continue;
    }

    // Get LP topics for student
    if (!lpCache.has(studentId)) {
      const { data: topics, error: topicsErr } = await sb
        .from('learning_path_topics')
        .select('id, title')
        .eq('student_id', studentId);
      if (topicsErr || !topics) {
        console.log(`  SKIP: failed to load LP topics: ${topicsErr?.message}`);
        skipped++;
        continue;
      }
      lpCache.set(studentId, topics);
    }

    const topics = lpCache.get(studentId)!;
    if (topics.length === 0) {
      console.log('  SKIP: student has no LP topics');
      skipped++;
      continue;
    }

    const extracted = extractTopicFromFilename(filename, studentName);
    console.log(`  Extracted topic: "${extracted}"`);

    const match = findMatchingTopic(extracted, topics);
    if (!match) {
      console.log(`  NO MATCH among ${topics.length} topics: [${topics.map((t) => t.title).join(', ')}]`);
      skipped++;
      continue;
    }

    console.log(`  MATCHED: "${match.title}" (id: ${match.id})`);

    const { error: updateErr } = await sb
      .from('attached_files')
      .update({ topic_id: match.id })
      .eq('id', file.id);

    if (updateErr) {
      console.log(`  ERROR updating: ${updateErr.message}`);
      skipped++;
    } else {
      console.log(`  UPDATED topic_id → ${match.id}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
