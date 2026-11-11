# Movie poster lookup setup

Movie and TV title search uses TMDB through a Supabase Edge Function. The TMDB access token stays on Supabase and is never sent to the browser.

1. Create a TMDB account and request an API **Read Access Token** from the TMDB API settings.
2. From the project directory, link the Supabase project and apply the database migration:

   ```powershell
   supabase login
   supabase link --project-ref lxnefknbnyqjsqbelqkc
   supabase db push
   ```

3. Store the TMDB token as a Supabase secret and deploy the search function:

   ```powershell
   supabase secrets set TMDB_API_READ_ACCESS_TOKEN=your_tmdb_read_access_token
   supabase functions deploy search-movies
   ```

After deployment, the Add Movie form searches titles as they are typed. Select the matching movie or show to attach its poster and details. Titles can still be saved without a match or poster.

The database migration adds nullable TMDB metadata columns to `public.watchlist_items`, so existing entries remain valid. This product uses the TMDB API but is not endorsed or certified by TMDB.
