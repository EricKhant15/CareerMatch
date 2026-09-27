export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export function buildStudentSemanticText(student, skills) {
  return [
    student.preferred_field ? `Preferred field: ${student.preferred_field}.` : "",
    student.major ? `Academic major: ${student.major}.` : "",
    student.career_goal ? `Career goal: ${student.career_goal}.` : "",
    skills.length ? `Skills: ${skills.map((skill) => skill.skill_name).filter(Boolean).join(", ")}.` : "",
  ].filter(Boolean).join(" ").trim();
}

export function buildListingSemanticText(listing, skillNames) {
  return [
    listing.title ? `Internship: ${listing.title}.` : "",
    listing.department ? `Department: ${listing.department}.` : "",
    listing.target_field ? `Target field: ${listing.target_field}.` : "",
    listing.description ? `Responsibilities: ${listing.description}.` : "",
    listing.learning_outcomes ? `Learning outcomes: ${listing.learning_outcomes}.` : "",
    skillNames.length ? `Relevant skills: ${skillNames.join(", ")}.` : "",
  ].filter(Boolean).join(" ").trim();
}

export async function generateEmbedding(text: string) {
  if (!text.trim()) return null;
  const model = new globalThis.Supabase.ai.Session("gte-small");
  const result = await model.run(text, { mean_pool: true, normalize: true });
  return Array.from(result);
}

export function parseVector(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number) : null;
  } catch {
    return null;
  }
}

export function cosineScore(first, second) {
  if (!first || !second || first.length !== second.length || !first.length) return null;
  let dot = 0;
  let firstLength = 0;
  let secondLength = 0;
  for (let index = 0; index < first.length; index += 1) {
    dot += first[index] * second[index];
    firstLength += first[index] ** 2;
    secondLength += second[index] ** 2;
  }
  if (!firstLength || !secondLength) return null;
  return Math.max(0, Math.min(100, (dot / Math.sqrt(firstLength * secondLength)) * 100));
}
