# Chore Chart Public Supabase v2

Includes Forgot Password / Reset Password.

Setup:
1. Supabase SQL Editor: run supabase_schema.sql.
2. Authentication > Providers > Email: Confirm Email OFF for easiest testing.
3. Authentication > URL Configuration:
   - Site URL: your Amplify URL.
   - Redirect URLs: add your Amplify URL.
4. config.js: paste Supabase URL and anon public key.
5. Push files to GitHub and let Amplify redeploy.
6. Hard refresh.

Forgot password:
- Click Forgot Password.
- Enter email.
- Supabase sends reset link.
- Link opens the same site.
- Set New Password screen appears.
