# CrossFit Training App - React Native Mobile

This is the React Native mobile version of the CrossFit Training App, built with Expo and expo-router.

## Stack

- **Expo** - React Native framework
- **expo-router** - File-based routing
- **NativeWind** - Tailwind CSS for React Native
- **Supabase** - Backend and authentication

## Setup

### 1. Install Dependencies

```bash
cd fitness-mobile
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Then edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EXPO_PUBLIC_API_URL=your_api_url_here
```

You can find these values in your main web app's `.env.local` file or Supabase dashboard.

### 3. Run the App

```bash
# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## Project Structure

```
fitness-mobile/
├── app/                          # File-based routing
│   ├── (tabs)/                  # Tab navigation screens
│   ├── workout/                 # Workout screens
│   │   └── [programId]/
│   │       └── week/
│   │           └── [week]/
│   │               └── day/
│   │                   └── [day].tsx  # Main workout page
│   └── _layout.tsx              # Root layout
├── components/                  # Reusable components
│   ├── ExerciseCard.tsx        # Individual exercise component
│   ├── MetConCard.tsx          # MetCon workout component
│   └── EngineBlockCard.tsx     # Engine conditioning component
├── lib/
│   └── supabase/
│       └── client.ts           # Supabase client configuration
└── global.css                  # Global Tailwind styles
```

## Key Features

### Workout Page

The main workout page (`app/workout/[programId]/week/[week]/day/[day].tsx`) includes:

- Dynamic route parameters for program, week, and day
- Progress tracking with visual progress bar
- Expandable/collapsible workout blocks
- Exercise completion with:
  - "As Prescribed" or "Modified" options
  - RPE (Rate of Perceived Exertion) tracking
  - Quality grading (A-D)
  - Notes
  - Weight/sets/reps logging
- MetCon workout tracking with:
  - Gender-specific benchmarks
  - Task performance tracking
  - Heart rate monitoring
- Engine conditioning workouts

### Components

#### ExerciseCard
- Displays exercise details (sets, reps, weight)
- Performance cues/notes
- Interactive completion form with As Rx/Modified options
- RPE slider and quality buttons
- Optimistic UI updates

#### MetConCard
- Gender selection for appropriate benchmarks
- Score input
- Heart rate tracking
- Task-specific RPE and quality ratings

#### EngineBlockCard
- Displays Engine workout summary
- Links to dedicated Engine workout screen
- Completion status tracking

## Styling

The app uses NativeWind for styling, which brings Tailwind CSS utility classes to React Native. The custom color palette matches the web app:

- `coral`: #FE5858
- `charcoal`: #282B34
- `ice-blue`: #F8FBFE
- `slate-blue`: #DAE2EA

## Backend Integration

The app expects the following API endpoints:

- `GET /api/workouts/:programId/week/:week/day/:day` - Fetch workout data
- `POST /api/workouts/complete` - Log exercise completion
- `POST /api/metcons/complete` - Log MetCon completion

Make sure your `EXPO_PUBLIC_API_URL` environment variable points to your backend server.

## Development Notes

### Supabase Configuration

The Supabase client is configured in `lib/supabase/client.ts` with:
- AsyncStorage for session persistence
- Auto token refresh
- React Native URL polyfill for compatibility

### Navigation

The app uses expo-router for file-based routing. Routes are defined by the file structure in the `app/` directory:

- `/workout/[programId]/week/[week]/day/[day]` - Dynamic workout route

### TypeScript

All components are fully typed with TypeScript interfaces for:
- Exercise data
- Workout data
- Completion data
- API responses

## Next Steps

1. Set up authentication screens
2. Create dashboard/home screen
3. Implement program selection
4. Add offline support
5. Implement push notifications for workout reminders
6. Add workout history screen

## Troubleshooting

### Metro bundler cache issues

```bash
npm start -- --clear
```

### iOS build issues

```bash
cd ios
pod install
cd ..
```

### Android build issues

```bash
cd android
./gradlew clean
cd ..
```

## License

Same as the main CrossFit Training App project.
