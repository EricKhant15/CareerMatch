import assert from "node:assert/strict";
import {
  calculateHybridRecommendation,
  isListingEligible,
} from "../supabase/functions/_shared/scoring.js";

const listing = {
  id: "listing-1",
  status: "Open",
  openings: 1,
  application_deadline: "2099-12-31",
  target_field: "Software Development",
  preferred_major: "Computer Science",
  preferred_year: "Year 3",
  minimum_availability: "3 days",
  location: "Bangkok",
  work_mode: "Hybrid",
  allowance: "Paid",
  mentorship: "Provided",
};

const student = {
  preferred_field: "Software Development",
  major: "Computer Science",
  year_of_study: "Year 3",
  availability: ["Mon", "Wed", "Fri"],
  preferred_location: "Bangkok",
  work_style: "Hybrid",
  internship_type: "Paid",
  mentorship: "Required",
};

const requirements = [
  { requirement_type: "required", skill_name: "JavaScript", skill_key: "javascript", minimum_level: 3 },
  { requirement_type: "nice_to_have", skill_name: "Git", skill_key: "git", minimum_level: 2 },
];

const studentSkills = [
  { skill_name: "JavaScript", skill_key: "javascript", level_number: 3 },
  { skill_name: "Git", skill_key: "git", level_number: 2 },
];

assert.equal(isListingEligible(listing, 0, new Date("2026-09-27T00:00:00Z")), true);
assert.equal(isListingEligible({ ...listing, status: "Closed" }, 0), false);
assert.equal(isListingEligible({ ...listing, application_deadline: "2020-01-01" }, 0), false);
assert.equal(isListingEligible(listing, 1), false);

const hybrid = calculateHybridRecommendation({
  listing,
  student,
  studentSkills,
  requirements,
  semanticScore: 80,
});
assert.equal(hybrid.qualificationScore, 100);
assert.equal(hybrid.compatibilityScore, 100);
assert.equal(hybrid.semanticScore, 80);
assert.equal(hybrid.score, 97);

const weightedFallback = calculateHybridRecommendation({
  listing,
  student,
  studentSkills,
  requirements,
});
assert.equal(weightedFallback.score, 100);

const partialSkill = calculateHybridRecommendation({
  listing: {
    status: "Open",
    openings: 1,
    required_skills: ["JavaScript"],
  },
  student: {},
  studentSkills: [{ skill_name: "JavaScript", skill_key: "javascript", level_number: 2 }],
  requirements: [{ requirement_type: "required", skill_name: "JavaScript", skill_key: "javascript", minimum_level: 4 }],
});
assert.equal(partialSkill.breakdown.requiredSkills, 50);
assert.equal(partialSkill.qualificationScore, 70);
assert.deepEqual(partialSkill.missingSkills, ["JavaScript (higher level needed)"]);

console.log("Hybrid scoring tests passed.");
