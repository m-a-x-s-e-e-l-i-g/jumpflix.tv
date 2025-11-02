# Supabase Authentication Setup

This project uses Supabase for user authentication with support for OAuth providers (Google, GitHub).

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/log in
2. Create a new project
3. Wait for the project to finish setting up

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`
2. In your Supabase dashboard, go to **Settings** → **API**
3. Copy the following values to your `.env` file:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Configure OAuth Providers (Optional)

To enable Google and GitHub sign-in:

#### Google OAuth
1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable Google provider
3. Follow Supabase's instructions to set up Google OAuth credentials
4. Add authorized redirect URIs

#### GitHub OAuth
1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable GitHub provider
3. Follow Supabase's instructions to set up GitHub OAuth app
4. Add authorized callback URLs

### 4. Configure Site URL

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Set your **Site URL** to:
   - Development: `http://localhost:5173`
   - Production: `https://www.jumpflix.tv`

### 5. Add Redirect URLs

Add the following to **Redirect URLs**:
- `http://localhost:5173/**`
- `https://www.jumpflix.tv/**`

## Features

- **User Sign In/Sign Up**: Email/password and OAuth providers (Google, GitHub)
- **User Profile Button**: Located in top-right corner, next to settings
- **Authentication State**: Persisted across page refreshes
- **User Menu**: Shows user info and sign-out option when authenticated
- **Responsive Design**: Works on mobile and desktop

## Components

- `UserProfileButton.svelte`: Main user profile button component
- `AuthDialog.svelte`: Authentication dialog/sheet with Supabase Auth UI
- `authStore.ts`: Svelte store for managing authentication state
- `supabaseClient.ts`: Supabase client initialization

## Usage in Code

```typescript
import { user, session, loading } from '$lib/stores/authStore';
import { supabase } from '$lib/supabaseClient';

// Check if user is authenticated
if ($user) {
  console.log('User is signed in:', $user.email);
}

// Sign out
await supabase.auth.signOut();
```

## Troubleshooting

### Authentication not working
- Ensure environment variables are set correctly
- Check Supabase dashboard for any configuration issues
- Verify OAuth provider settings if using Google/GitHub

### Redirect issues
- Make sure Site URL and Redirect URLs are configured properly
- Check browser console for error messages

### Session not persisting
- Ensure cookies are enabled in browser
- Check that Supabase client is initialized properly
