# CareerMatch

CareerMatch is a Supabase-backed internship matching system for CS-related students and companies.

## Working features

- Student and company account registration and sign-in
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

## Supabase setup

Run these files in the Supabase SQL Editor in this order:

1. `supabase-internship-workflow.sql`
2. `supabase-narrow-skill-catalog.sql`
3. `supabase-interview-workflow.sql`
4. `supabase-offer-workflow.sql`

The first migration adds listing updates, notifications, experience fields, and private CV storage. The second limits the active skill catalog to the selected university-focused skills. The third adds interview fields and application-specific notifications. The fourth separates company offers from student acceptance and manages filled internship slots.

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

- Dedicated student and company settings pages
- Email delivery in addition to in-app notifications
- Interview confirmation by the student
- Automated browser tests and production deployment
