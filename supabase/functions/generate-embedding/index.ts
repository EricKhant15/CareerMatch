import { createClient } from "npm:@supabase/supabase-js@2";
import { buildListingSemanticText, buildStudentSemanticText, corsHeaders, generateEmbedding, jsonResponse } from "../_shared/semantic.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return jsonResponse({ error: "Authentication required." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Invalid session." }, 401);
    const { type, id } = await request.json();
    if (!id || !["student", "internship"].includes(type)) return jsonResponse({ error: "Provide a student or internship id." }, 400);

    if (type === "student") {
      const { data: student, error } = await admin.from("students")
        .select("id, profile_id, major, preferred_field, career_goal")
        .eq("id", id).eq("profile_id", userData.user.id).single();
      if (error || !student) return jsonResponse({ error: "Student profile not found." }, 404);
      const { data: skills } = await admin.from("student_skills").select("skill_name").eq("student_id", student.id);
      const semanticText = buildStudentSemanticText(student, skills || []);
      const embedding = await generateEmbedding(semanticText);
      const { error: updateError } = await admin.from("students").update({
        semantic_text: semanticText, semantic_embedding: embedding, embedding_updated_at: new Date().toISOString(),
      }).eq("id", student.id);
      if (updateError) throw updateError;
      return jsonResponse({ updated: true, type, id: student.id });
    }

    const { data: listing, error: listingError } = await admin.from("internship_listings")
      .select("id, company_id, title, department, target_field, description, learning_outcomes, required_skills, nice_to_have_skills")
      .eq("id", id).single();
    if (listingError || !listing) return jsonResponse({ error: "Internship not found." }, 404);
    const { data: company } = await admin.from("companies").select("id")
      .eq("id", listing.company_id).eq("profile_id", userData.user.id).maybeSingle();
    if (!company) return jsonResponse({ error: "You do not own this internship." }, 403);
    const skillNames = [...new Set([...(listing.required_skills || []), ...(listing.nice_to_have_skills || [])])];
    const semanticText = buildListingSemanticText(listing, skillNames);
    const embedding = await generateEmbedding(semanticText);
    const { error: updateError } = await admin.from("internship_listings").update({
      semantic_text: semanticText, semantic_embedding: embedding, embedding_updated_at: new Date().toISOString(),
    }).eq("id", listing.id);
    if (updateError) throw updateError;
    return jsonResponse({ updated: true, type, id: listing.id });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Embedding generation failed." }, 500);
  }
});
