# CareerMatch

CareerMatch is a Supabase-backed internship matching system for CS-related students and companies.

## Working features

- Student and company account registration and sign-in
- Signed-in password changes and email-based forgotten-password recovery
- Company verification and admin approval
- Student onboarding, profile editing, availability, preferences, and skill levels
- Company internship creation and editing
- Required and nice-to-have skills with minimum levels
- Student experience, benefits, mentorship, and completion documents
- Student internship recommendations ranked by match score
- Visible matched and missing required skills
- Saving internships
- PDF CV upload during application
- Company applicant review, qualification ranking, CV viewing, shortlisting, and rejection
- Real Manage Listings and company dashboard data
- Listing status controls: Open, Closed, Filled, and Archived
- Student and company notification bell with unread counts
- Shortlisted candidate pipeline
- Interview drafts, scheduling, cancellation, staged interviews, and final decisions
- Internship offers that students can accept or decline with an optional reason
- One accepted internship per student, automatic decline of other pending offers, and automatic slot closure

## Matching formula

Company qualification score:

- Required skills: 60%
- Nice-to-have skills: 15%
- Target field: 15%
- Major: 5%
- Year of study: 5%

Student recommendation score:

- Qualification score: 70%
- Compatibility score: 30%

Compatibility uses availability (30%), location (20%), work mode (20%), allowance (15%), and mentorship (15%). Skill levels receive partial credit with `min(student level / required level, 1)`.

## Hybrid recommender

The next recommender version is implemented with three stages:

1. Rule-based filtering removes listings that are closed, expired, or already full.
2. Structured scoring calculates qualification and practical compatibility.
3. Semantic matching compares non-sensitive student interests with internship content using normalized `gte-small` embeddings.

When a semantic score is available, the final score uses 60% qualification, 25% compatibility, and 15% semantic alignment. If embeddings or Edge Functions are unavailable, the recommendations page automatically uses the original 70% qualification and 30% compatibility calculation.

Apply `supabase/migrations/005_hybrid_recommender.sql`, then deploy both Edge Functions:

```bash
supabase functions deploy generate-embedding
supabase functions deploy recommend-internships
```

The hosted functions use Supabase's built-in `gte-small` model, the signed-in user's JWT, and the standard server-side Supabase environment variables. Never expose the service-role key in browser code.

## Supabase setup

The database migration scripts are kept in `supabase/migrations/` for reproducibility. Run them once in the Supabase SQL Editor in this order when setting up a new project:

1. `supabase/migrations/001_internship_workflow.sql`
2. `supabase/migrations/002_narrow_skill_catalog.sql`
3. `supabase/migrations/003_interview_workflow.sql`
4. `supabase/migrations/004_offer_workflow.sql`
5. `supabase/migrations/005_hybrid_recommender.sql`

These scripts are project setup history; the website does not load them at runtime. Vercel excludes the `supabase/` folder from deployment.

The first migration adds listing updates, notifications, experience fields, and private CV storage. The second limits the active skill catalog to the selected university-focused skills. The third adds interview fields and application-specific notifications. The fourth separates company offers from student acceptance and manages filled internship slots. The fifth adds semantic text and vector storage for the hybrid recommender.

## Password recovery setup

Password changes and reset links use Supabase Auth; application tables never store passwords.

In Supabase Dashboard, open **Authentication → URL Configuration** and add the exact reset-page URLs used by CareerMatch. For example:

```text
http://127.0.0.1:5500/reset-password.html
https://your-careermatch-domain.vercel.app/reset-password.html
```

The local URL must match the host and port shown by VS Code Live Server. For production, configure custom SMTP in Supabase so recovery emails are delivered reliably and are not limited by the default testing mail service.

## Local testing flow

1. Start the project with VS Code Live Server.
2. Sign in as an approved company and publish a listing.
3. Sign in as a student in another browser profile or private window.
4. Complete the student profile, review recommendations, save a listing, and apply with a PDF CV.
5. Return to the company account, open Manage Listings, review the applicant, and shortlist them.
6. Open Shortlisted, schedule an interview, and send the invitation.
7. Confirm the interview details appear in the student's Applications page.
8. Send an internship offer after the interview.
9. Accept or decline it from the student Applications page and confirm that the company receives the response.

## Optional polish after the core demonstration

- Email delivery in addition to in-app notifications
- Interview confirmation by the student
- Automated browser tests and production deployment
