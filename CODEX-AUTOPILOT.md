# Chant League Codex Autopilot

Codex is responsible for maintaining a working production deployment.

Stack:
Next.js 16
Vercel
Supabase
TypeScript

## Primary Objective
Ensure the Vercel deployment always builds successfully and the site runs without errors.

If the build fails, Codex must diagnose and fix the issue automatically.

---

# Autopilot Responsibilities

Codex must:

1. Detect Vercel build errors
2. Read build logs
3. Fix TypeScript or runtime errors
4. Commit fixes
5. Push to GitHub
6. Trigger a new Vercel deployment

This loop continues until deployment succeeds.

---

# Allowed Automatic Fixes

Codex may automatically fix:

• Missing imports  
• Incorrect imports  
• TypeScript type errors  
• Supabase query typing  
• Next.js routing issues  
• Missing environment variable usage  
• Build configuration problems

Example fix:

Error:
Module '@/app/lib/supabase' has no exported member 'Match'

Codex action:
Remove the incorrect import.

---

# Build Verification

After each fix Codex must confirm:

1. Vercel build succeeds
2. No TypeScript errors remain
3. Routes return valid pages

Required working routes:

/
 /test
 /admin/battles
 /clubs
 /battles
 /leaderboards

---

# Supabase Rules

Codex must use the Supabase client located in:

app/lib/supabase.ts

Queries must follow this pattern:

const { data, error } = await supabase
  .from("battles")
  .select("*")

Handle errors gracefully.

---

# Safe Refactoring Rules

Codex must never:

• delete environment variables
• remove Supabase configuration
• remove authentication logic
• break existing working routes

---

# Commit Rules

Codex commits using clear messages:

fix: resolve build failure
fix: correct supabase import
fix: typescript error
fix: nextjs routing error

Then push immediately.

---

# Autopilot Loop

If deployment fails:

1. Read Vercel build logs
2. Identify error
3. Patch code
4. Commit
5. Push
6. Redeploy
7. Repeat until build succeeds

---

# Chant League Goal

Maintain a continuously deployable platform for:

• Chant battles
• Fan voting
• Club pages
• Leaderboards
• Admin battle management
