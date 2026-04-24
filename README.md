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


## v13 changes
- Admin requires password re-check before the admin dashboard opens.
- Admin unlock lasts 15 minutes per browser tab/session.
- Family invite code appears in Admin > Family Settings.
- Another parent can use Join Family with that invite code to create their own admin login.
- Kid chore buttons can be undone on the same day if marked by accident.
- Activity messages include who made the change when a separate admin login is used.

## Supabase update
Run the full `supabase_schema.sql` again in SQL Editor. It uses `if not exists` / `create or replace` where needed, so it updates your existing database.


## v14 timeline
- Admin dashboard now has a Timeline section.
- Click a kid button to see that child's full change history.
- Green check = chore done.
- Red X = chore not done.
- Done after 10 PM is shown all red.
- Admin point adjustments show up/down color.
- Timeline shows which admin made the change.
- Run the updated `supabase_schema.sql` again to add the new timeline columns.
