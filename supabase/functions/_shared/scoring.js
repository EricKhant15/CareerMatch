export const HYBRID_WEIGHTS = Object.freeze({ qualification: 60, compatibility: 25, semantic: 15 });
export const QUALIFICATION_WEIGHTS = Object.freeze({ requiredSkills: 60, niceSkills: 15, targetField: 15, major: 5, year: 5 });
export const COMPATIBILITY_WEIGHTS = Object.freeze({ availability: 30, location: 20, workMode: 20, allowance: 15, mentorship: 15 });

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeSkill(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export function isListingEligible(listing, acceptedCount = 0, today = new Date()) {
  if (normalizeText(listing.status) !== "open") return false;
  const todayText = today.toISOString().slice(0, 10);
  if (listing.application_deadline && listing.application_deadline < todayText) return false;
  return acceptedCount < Math.max(Number(listing.openings) || 1, 1);
}

function getRequiredAvailability(value) {
  if (normalizeText(value) === "full-time") return 5;
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getMentorshipMatch(studentPreference, companyOption) {
  const preference = normalizeText(studentPreference);
  const option = normalizeText(companyOption);
  if (!preference || preference === "not needed") return 1;
  if (preference === "required") {
    if (option === "provided") return 1;
    if (option === "limited") return 0.5;
    return 0;
  }
  if (preference === "preferred") {
    if (option === "provided") return 1;
    if (option === "limited") return 0.75;
    return 0.25;
  }
  return 0.5;
}

function calculateSkillMatch(requirements, studentSkills, trackGaps = false) {
  if (!requirements.length) return { ratio: 1, matchedSkills: [], missingSkills: [], skillStatuses: [] };
  const skillMap = new Map(studentSkills.map((skill) => [
    normalizeSkill(skill.skill_key || skill.skill_name),
    Number(skill.level_number) || 1,
  ]));
  let earned = 0;
  const matchedSkills = [];
  const missingSkills = [];
  const skillStatuses = [];

  requirements.forEach((requirement) => {
    const name = requirement.skill_name || "Required skill";
    const studentLevel = skillMap.get(normalizeSkill(requirement.skill_key || name)) || 0;
    const requiredLevel = Number(requirement.minimum_level) || 1;
    const matched = studentLevel >= requiredLevel;
    earned += Math.min(studentLevel / requiredLevel, 1);
    skillStatuses.push({ name, matched, studentLevel, requiredLevel });
    if (!trackGaps) return;
    if (matched) matchedSkills.push(name);
    else if (studentLevel > 0) missingSkills.push(`${name} (higher level needed)`);
    else missingSkills.push(name);
  });

  return { ratio: earned / requirements.length, matchedSkills, missingSkills, skillStatuses };
}

function weightedAvailable(criteria) {
  const available = criteria.filter((item) => item.ratio !== null);
  if (!available.length) return null;
  const weight = available.reduce((sum, item) => sum + item.weight, 0);
  return available.reduce((sum, item) => sum + item.ratio * item.weight, 0) / weight;
}

function clampPercentage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

export function calculateHybridRecommendation({ listing, student, studentSkills, requirements, semanticScore = null }) {
  const requiredResult = calculateSkillMatch(requirements.filter((item) => item.requirement_type === "required"), studentSkills, true);
  const niceResult = calculateSkillMatch(requirements.filter((item) => item.requirement_type === "nice_to_have"), studentSkills);
  const fieldRatio = listing.target_field ? Number(normalizeText(student.preferred_field) === normalizeText(listing.target_field)) : 1;
  const majorRatio = listing.preferred_major ? Number(normalizeText(student.major) === normalizeText(listing.preferred_major)) : 1;
  const yearRatio = listing.preferred_year ? Number(normalizeText(student.year_of_study) === normalizeText(listing.preferred_year)) : 1;
  const qualificationScore = Math.round(
    requiredResult.ratio * QUALIFICATION_WEIGHTS.requiredSkills +
    niceResult.ratio * QUALIFICATION_WEIGHTS.niceSkills +
    fieldRatio * QUALIFICATION_WEIGHTS.targetField +
    majorRatio * QUALIFICATION_WEIGHTS.major +
    yearRatio * QUALIFICATION_WEIGHTS.year
  );

  const requiredDays = getRequiredAvailability(listing.minimum_availability);
  const availableDays = Array.isArray(student.availability) ? student.availability.length : 0;
  const availabilityRatio = listing.minimum_availability && requiredDays > 0 ? Math.min(availableDays / requiredDays, 1) : null;
  const remote = normalizeText(listing.work_mode) === "remote";
  const locationRatio = listing.location && student.preferred_location
    ? Number(remote || normalizeText(listing.location) === normalizeText(student.preferred_location)) : null;
  const workModeRatio = listing.work_mode && student.work_style
    ? Number(normalizeText(listing.work_mode) === normalizeText(student.work_style)) : null;
  const allowanceRatio = listing.allowance && student.internship_type
    ? Number(normalizeText(student.internship_type) === "either" || normalizeText(listing.allowance) === normalizeText(student.internship_type)) : null;
  const mentorshipRatio = listing.mentorship && student.mentorship
    ? getMentorshipMatch(student.mentorship, listing.mentorship) : null;
  const compatibilityRatio = weightedAvailable([
    { ratio: availabilityRatio, weight: COMPATIBILITY_WEIGHTS.availability },
    { ratio: locationRatio, weight: COMPATIBILITY_WEIGHTS.location },
    { ratio: workModeRatio, weight: COMPATIBILITY_WEIGHTS.workMode },
    { ratio: allowanceRatio, weight: COMPATIBILITY_WEIGHTS.allowance },
    { ratio: mentorshipRatio, weight: COMPATIBILITY_WEIGHTS.mentorship },
  ]);
  const compatibilityScore = compatibilityRatio === null ? null : Math.round(compatibilityRatio * 100);
  const safeSemanticScore = clampPercentage(semanticScore);

  let score;
  if (safeSemanticScore !== null) {
    const factors = [
      { score: qualificationScore, weight: HYBRID_WEIGHTS.qualification },
      { score: compatibilityScore, weight: HYBRID_WEIGHTS.compatibility },
      { score: safeSemanticScore, weight: HYBRID_WEIGHTS.semantic },
    ].filter((factor) => factor.score !== null);
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    score = Math.round(factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0) / totalWeight);
  } else {
    score = compatibilityScore === null ? qualificationScore : Math.round(qualificationScore * 0.7 + compatibilityScore * 0.3);
  }

  return {
    ...listing,
    score,
    qualificationScore,
    compatibilityScore,
    semanticScore: safeSemanticScore,
    breakdown: {
      requiredSkills: Math.round(requiredResult.ratio * 100),
      niceSkills: Math.round(niceResult.ratio * 100),
      targetField: Math.round(fieldRatio * 100),
      major: Math.round(majorRatio * 100),
      year: Math.round(yearRatio * 100),
      availability: availabilityRatio === null ? null : Math.round(availabilityRatio * 100),
      location: locationRatio === null ? null : Math.round(locationRatio * 100),
      workMode: workModeRatio === null ? null : Math.round(workModeRatio * 100),
      allowance: allowanceRatio === null ? null : Math.round(allowanceRatio * 100),
      mentorship: mentorshipRatio === null ? null : Math.round(mentorshipRatio * 100),
      semantic: safeSemanticScore,
    },
    matchedSkills: requiredResult.matchedSkills,
    missingSkills: requiredResult.missingSkills,
    requiredSkillStatuses: requiredResult.skillStatuses,
    niceSkillStatuses: niceResult.skillStatuses,
  };
}
