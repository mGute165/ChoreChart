# Shared Family Chore Web App

This is the cheapest public version:
- static website
- Supabase login and data
- separate household per signup

Host these files on AWS Amplify Hosting or S3/CloudFront.

## Setup
1. Create a Supabase project
2. Run `supabase_schema.sql` in the SQL Editor
3. In Supabase Auth, disable email confirmation for the easiest first setup
4. Put your project URL and anon key into `config.js`
5. Upload the files to AWS hosting

## What each signup does
- creates a new household
- creates the first admin profile
- keeps each family separate
