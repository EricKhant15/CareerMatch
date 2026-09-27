import { createClient } from "npm:@supabase/supabase-js@2";
import { calculateHybridRecommendation, HYBRID_WEIGHTS, isListingEligible, normalizeSkill } from "../_shared/scoring.js";
import {
  buildListingSemanticText,
  buildStudentSemanticText,
  corsHeaders,
  cosineScore,
  generateEmbedding,
  jsonResponse,
  parseVector,
} from "../_shared/semantic.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return jsonResponse({ error: "Authentication required." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Invalid session." }, 401);

    const { data: profile } = await admin.from("profiles").select("role, account_status")
      .eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "student" || profile.account_status !== "approved") {
      return jsonResponse({ error: "An approved student account is required." }, 403);
    }

    const { data: student, error: studentError } = await admin.from("students").select("*")
      .eq("profile_id", userData.user.id).single();
    if (studentError || !student) return jsonResponse({ error: "Complete your student profile first." }, 400);
    const { data: studentSkills, error: skillError } = await admin.from("student_skills")
      .select("skill_name, skill_key, skill_level, level_number").eq("student_id", student.id);
    if (skillError) throw skillError;

    const studentSemanticText = buildStudentSemanticText(student, studentSkills || []);
    let studentVector = parseVector(student.semantic_embedding);
    if (!studentVector || student.semantic_text !== studentSemanticText) {
      const semanticText = studentSemanticText;
      studentVector = await generateEmbedding(semanticText);
      const { error } = await admin.from("students").update({
        semantic_text: semanticText,
        semantic_embedding: studentVector,
        embedding_updated_at: new Date().toISOString(),
      }).eq("id", student.id);
      if (error) throw error;
    }

    const { data: listings, error: listingError } = await admin.from("internship_listings")
      .select("*").eq("status", "Open").order("created_at", { ascending: false });
    if (listingError) throw listingError;
    const listingIds = (listings || []).map((listing) => listing.id);
    if (!listingIds.length) return jsonResponse({ recommendations: [], algorithm: "hybrid-v1", weights: HYBRID_WEIGHTS });

    const [{ data: companies, error: companyError }, { data: requirementRows, error: requirementError }, { data: acceptedRows, error: acceptedError }] = await Promise.all([
      admin.from("companies").select("id, company_name").in("id", [...new Set(listings.map((listing) => listing.company_id))]),
      admin.from("listing_skills").select("listing_id, skill_id, requirement_type, minimum_level").in("listing_id", listingIds),
      admin.from("applications").select("listing_id").in("listing_id", listingIds).eq("offer_status", "Accepted"),
    ]);
    if (companyError) throw companyError;
    if (requirementError) throw requirementError;
    if (acceptedError) throw acceptedError;

    const skillIds = [...new Set((requirementRows || []).map((row) => row.skill_id))];
    let skillCatalog = [];
    if (skillIds.length) {
      const { data, error } = await admin.from("skills").select("id, name, skill_key").in("id", skillIds);
      if (error) throw error;
      skillCatalog = data || [];
    }
    const skillsById = new Map(skillCatalog.map((skill) => [skill.id, skill]));
    const requirementsByListing = new Map();
    (requirementRows || []).forEach((row) => {
      const skill = skillsById.get(row.skill_id);
      if (!skill) return;
      const current = requirementsByListing.get(row.listing_id) || [];
      current.push({ ...row, skill_name: skill.name, skill_key: skill.skill_key });
      requirementsByListing.set(row.listing_id, current);
    });
    const acceptedCounts = new Map();
    (acceptedRows || []).forEach((row) => acceptedCounts.set(row.listing_id, (acceptedCounts.get(row.listing_id) || 0) + 1));
    const companiesById = new Map((companies || []).map((company) => [company.id, company.company_name]));

    const recommendations = [];
    for (const listing of listings || []) {
      if (!isListingEligible(listing, acceptedCounts.get(listing.id) || 0)) continue;
      let requirements = requirementsByListing.get(listing.id) || [];
      if (!requirements.length) {
        requirements = [
          ...(listing.required_skills || []).map((name) => ({ skill_name: name, skill_key: normalizeSkill(name), minimum_level: 1, requirement_type: "required" })),
          ...(listing.nice_to_have_skills || []).map((name) => ({ skill_name: name, skill_key: normalizeSkill(name), minimum_level: 1, requirement_type: "nice_to_have" })),
        ];
      }

      const listingSemanticText = buildListingSemanticText(listing, requirements.map((item) => item.skill_name));
      let listingVector = parseVector(listing.semantic_embedding);
      if (!listingVector || listing.semantic_text !== listingSemanticText) {
        const semanticText = listingSemanticText;
        listingVector = await generateEmbedding(semanticText);
        const { error } = await admin.from("internship_listings").update({
          semantic_text: semanticText,
          semantic_embedding: listingVector,
          embedding_updated_at: new Date().toISOString(),
        }).eq("id", listing.id);
        if (error) throw error;
      }

      const recommendation = calculateHybridRecommendation({
        listing,
        student,
        studentSkills: studentSkills || [],
        requirements,
        semanticScore: cosineScore(studentVector, listingVector),
      });
      recommendations.push({ ...recommendation, company_name: companiesById.get(listing.company_id) || "Company" });
    }

    recommendations.sort((first, second) => second.score - first.score);
    return jsonResponse({ recommendations, algorithm: "hybrid-v1", weights: HYBRID_WEIGHTS });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Recommendations could not be calculated." }, 500);
  }
});
