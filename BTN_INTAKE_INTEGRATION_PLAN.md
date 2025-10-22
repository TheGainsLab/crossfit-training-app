# BTN Intake Integration Plan
## Connecting User Profile Data to Workout Generation

---

## Current State

### What Works:
- ✅ BTN users complete full intake (equipment, skills, 1RMs, conditioning)
- ✅ Data is saved to database
- ✅ Profile is generated
- ✅ Workout generator exists and creates 10 workouts

### What Doesn't Work:
- ❌ Workout generator ignores intake data
- ❌ Generates random workouts regardless of:
  - User's equipment
  - User's skill levels
  - User's 1RMs
  - User's gender

---

## Goal

**Personalize BTN workouts based on intake data:**
1. Filter exercises by available equipment
2. Exclude movements user can't do
3. Adjust rep ranges by skill level
4. Calculate weights from 1RMs
5. Add "Roll Your Own" toggle to bypass filters

---

## Implementation Plan

### STEP 1: Load User Profile Data in BTN Generator

**File:** `app/btn/page.tsx`

**Current code (line 18-33):**
```typescript
function BTNWorkoutGenerator() {
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWorkouts = () => {
    setIsGenerating(true);
    try {
      const workouts = generateTestWorkouts();  // ← No user data passed
      setGeneratedWorkouts(workouts);
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate workouts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
```

**New code needed:**
```typescript
function BTNWorkoutGenerator() {
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [rollYourOwn, setRollYourOwn] = useState(false);

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Get user ID from users table
    const { data: userData } = await supabase
      .from('users')
      .select('id, gender, body_weight')
      .eq('auth_id', user.id)
      .single();

    if (!userData) return;

    // Load equipment
    const { data: equipment } = await supabase
      .from('user_equipment')
      .select('equipment_name')
      .eq('user_id', userData.id);

    // Load skills
    const { data: skills } = await supabase
      .from('user_skills')
      .select('skill_name, skill_level')
      .eq('user_id', userData.id);

    // Load 1RMs
    const { data: oneRMs } = await supabase
      .from('user_one_rms')
      .select('exercise_name, one_rm')
      .eq('user_id', userData.id);

    setUserProfile({
      gender: userData.gender,
      bodyWeight: userData.body_weight,
      equipment: equipment?.map(e => e.equipment_name) || [],
      skills: skills || [],
      oneRMs: oneRMs || []
    });
  };

  const generateWorkouts = () => {
    setIsGenerating(true);
    try {
      // Pass user profile to generator
      const workouts = generateTestWorkouts(
        rollYourOwn ? null : userProfile  // If "Roll Your Own", pass null
      );
      setGeneratedWorkouts(workouts);
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate workouts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
```

---

### STEP 2: Update Generator to Accept User Profile

**File:** `lib/btn/utils.ts`

**Current function signature (line ~50):**
```typescript
export function generateTestWorkouts(): GeneratedWorkout[] {
  // ...
}
```

**New function signature:**
```typescript
export function generateTestWorkouts(userProfile?: UserProfile | null): GeneratedWorkout[] {
  // If no profile provided, use default behavior (all exercises)
  const availableEquipment = userProfile?.equipment || ALL_EQUIPMENT;
  const userSkills = userProfile?.skills || [];
  const userOneRMs = userProfile?.oneRMs || [];
  const userGender = userProfile?.gender || 'Male';
  
  // ... rest of generation logic
}
```

---

### STEP 3: Equipment Filtering

**File:** `lib/btn/utils.ts`

**Add equipment filter function:**
```typescript
function filterExercisesByEquipment(
  exercises: string[], 
  availableEquipment: string[]
): string[] {
  return exercises.filter(exerciseName => {
    const requiredEquipment = exerciseEquipment[exerciseName] || [];
    
    // If exercise has no equipment requirement, allow it
    if (requiredEquipment.length === 0) return true;
    
    // Check if user has ALL required equipment
    return requiredEquipment.every(eq => availableEquipment.includes(eq));
  });
}
```

**Use in generation:**
```typescript
// Before selecting exercises for a workout
let eligibleExercises = exerciseDatabase.filter(ex => 
  ex.timeDomain === targetTimeDomain
);

// Apply equipment filter if user profile provided
if (userProfile) {
  eligibleExercises = filterExercisesByEquipment(
    eligibleExercises.map(ex => ex.name),
    userProfile.equipment
  );
}
```

---

### STEP 4: Skills Filtering

**File:** `lib/btn/utils.ts`

**Add skills filter function:**
```typescript
function filterExercisesBySkills(
  exercises: string[],
  userSkills: Array<{ skill_name: string; skill_level: string }>
): string[] {
  return exercises.filter(exerciseName => {
    // Check if this exercise requires a skill
    const requiredSkill = skillsMapping[exerciseName]; // Need to create this mapping
    
    if (!requiredSkill) return true; // Not a skill-based exercise
    
    // Find user's level for this skill
    const userSkill = userSkills.find(s => s.skill_name === requiredSkill);
    
    // If user doesn't have this skill at all, exclude it
    if (!userSkill || userSkill.skill_level === "Don't have it") {
      return false;
    }
    
    // Include if user has any level of the skill
    return true;
  });
}
```

**Create skills mapping:**
```typescript
// Map exercises to required skills
const skillsMapping: { [exercise: string]: string } = {
  'Ring Muscle-ups': 'Ring Muscle-ups',
  'Bar Muscle-ups': 'Bar Muscle-ups',
  'Rope Climbs': 'Rope Climbs',
  'Handstand Push-ups': 'Strict Handstand Push-ups',
  'Double Unders': 'Double Unders',
  'Pull-ups': 'Pull-ups (kipping or butterfly)',
  'Chest to Bar Pull-ups': 'Chest to Bar Pull-ups',
  'Toes to Bar': 'Toes to Bar',
  // ... add more mappings
};
```

---

### STEP 5: Adjust Rep Ranges by Skill Level

**File:** `lib/btn/utils.ts`

**Modify rep calculation:**
```typescript
function calculateRepsForTimeDomain(
  timeDomain: string,
  exerciseName: string,
  userSkills?: Array<{ skill_name: string; skill_level: string }>
): number {
  // Get base reps from current logic
  let baseReps = getBaseReps(timeDomain, exerciseName);
  
  if (!userSkills) return baseReps;
  
  // Find if this is a skill-based exercise
  const requiredSkill = skillsMapping[exerciseName];
  if (!requiredSkill) return baseReps;
  
  const userSkill = userSkills.find(s => s.skill_name === requiredSkill);
  if (!userSkill) return baseReps;
  
  // Adjust reps based on skill level
  if (userSkill.skill_level.includes('Beginner')) {
    return Math.max(3, Math.floor(baseReps * 0.6)); // 60% of base reps
  } else if (userSkill.skill_level.includes('Intermediate')) {
    return Math.floor(baseReps * 0.8); // 80% of base reps
  } else if (userSkill.skill_level.includes('Advanced')) {
    return Math.floor(baseReps * 1.2); // 120% of base reps
  }
  
  return baseReps;
}
```

---

### STEP 6: Weight Personalization from 1RMs

**File:** `lib/btn/utils.ts`

**Update weight generation:**
```typescript
function generateWeightForExercise(
  exerciseName: string,
  gender: string,
  userOneRMs?: Array<{ exercise_name: string; one_rm: number }>
): string {
  // If user has 1RM for this exercise, calculate from it
  if (userOneRMs) {
    const userMax = userOneRMs.find(rm => 
      rm.exercise_name.toLowerCase().includes(exerciseName.toLowerCase()) ||
      exerciseName.toLowerCase().includes(rm.exercise_name.toLowerCase())
    );
    
    if (userMax && userMax.one_rm > 0) {
      // Use percentage of 1RM based on exercise type
      let percentage = 0.6; // Default to 60%
      
      if (exerciseName.includes('Snatch')) percentage = 0.5;
      if (exerciseName.includes('Clean')) percentage = 0.55;
      if (exerciseName.includes('Deadlift')) percentage = 0.65;
      if (exerciseName.includes('Squat')) percentage = 0.6;
      
      const weight = Math.round(userMax.one_rm * percentage / 5) * 5; // Round to nearest 5
      return String(weight);
    }
  }
  
  // Fallback to current generic logic
  return getGenericWeight(exerciseName, gender);
}
```

---

### STEP 7: Add "Roll Your Own" Toggle UI

**File:** `app/btn/page.tsx`

**Add toggle before generator:**
```typescript
<div className="bg-white rounded-xl shadow-md p-8 mb-8">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h2 className="text-2xl font-bold">Workout Generator</h2>
      <p className="text-gray-600">
        {rollYourOwn 
          ? "Generating random workouts (no restrictions)" 
          : "Generating personalized workouts based on your profile"
        }
      </p>
    </div>
    
    <div className="flex items-center gap-3">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={rollYourOwn}
          onChange={(e) => setRollYourOwn(e.target.checked)}
          className="sr-only peer"
        />
        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FE5858]"></div>
        <span className="ml-3 text-sm font-medium text-gray-900">Roll Your Own</span>
      </label>
      
      {!rollYourOwn && userProfile && (
        <div className="text-xs text-gray-500">
          {userProfile.equipment.length} equipment items
        </div>
      )}
    </div>
  </div>
```

---

### STEP 8: Show Profile Link

**File:** `app/btn/page.tsx`

**Add prominent profile link:**
```typescript
<div className="text-center mb-10">
  <h1 className="text-4xl font-bold mb-2">BTN Workout Generator</h1>
  <p className="text-gray-600">Generate realistic CrossFit workouts</p>
  
  {userProfile && (
    <div className="mt-4 inline-flex items-center gap-4">
      <Link 
        href="/profile" 
        className="text-sm text-blue-600 hover:text-blue-800 underline"
      >
        View/Edit Your Profile →
      </Link>
      <span className="text-xs text-gray-500">
        Workouts personalized to your {userProfile.equipment.length} equipment items
      </span>
    </div>
  )}
</div>
```

---

## Data Structures Needed

### UserProfile Interface
```typescript
interface UserProfile {
  gender: string;
  bodyWeight: number;
  equipment: string[];
  skills: Array<{
    skill_name: string;
    skill_level: string;
  }>;
  oneRMs: Array<{
    exercise_name: string;
    one_rm: number;
  }>;
}
```

### Exercise Equipment Mapping
Already exists in `lib/btn/data.ts` as `exerciseEquipment`

---

## Testing Plan

### Test Case 1: No Equipment Filtering
**Setup:**
- User has: Barbell, Pull-up Bar only
- Generate workouts

**Expected:**
- No rope climbs
- No ring exercises
- No GHD movements
- Only barbell + bodyweight exercises

### Test Case 2: Skill Filtering
**Setup:**
- User skill levels:
  - Ring Muscle-ups: Don't have it
  - Double Unders: Beginner (1-25)
  - Pull-ups: Advanced (More than 15)

**Expected:**
- No Ring Muscle-ups in any workout
- Double Unders limited to 20-30 reps max
- Pull-ups can be 20+ reps

### Test Case 3: Weight Personalization
**Setup:**
- User 1RMs:
  - Clean: 225 lbs
  - Snatch: 155 lbs
  - Back Squat: 315 lbs

**Expected:**
- Clean weights around 120-135 lbs (55-60%)
- Snatch weights around 75-95 lbs (50-60%)
- Back Squat weights around 185-225 lbs (60-70%)

### Test Case 4: Roll Your Own Mode
**Setup:**
- Toggle "Roll Your Own" ON
- Same user as Test Case 1

**Expected:**
- CAN include rope climbs
- CAN include ring exercises
- Ignores all equipment/skill restrictions
- Uses generic weights

---

## Rollout Plan

### Phase 1: Equipment Filtering Only (Week 1)
- Load user equipment
- Filter exercises by available equipment
- Add "Roll Your Own" toggle
- **Goal:** No exercises requiring unavailable equipment

### Phase 2: Skills Filtering (Week 2)
- Load user skills
- Exclude exercises for skills user doesn't have
- Keep rep ranges same for now
- **Goal:** No impossible movements

### Phase 3: Skill-Based Rep Adjustment (Week 3)
- Adjust rep ranges based on skill level
- Beginner = lower reps
- Advanced = higher reps
- **Goal:** Appropriate volume for skill level

### Phase 4: Weight Personalization (Week 4)
- Load user 1RMs
- Calculate workout weights from 1RMs
- Fall back to generic if no 1RM
- **Goal:** Realistic weights based on maxes

---

## Success Metrics

### Quantitative:
- % of generated workouts user can actually do
- Average workouts generated per user per week
- Completion rate (when we add result logging)
- Time to first workout generation

### Qualitative:
- User feedback: "Workouts feel right for my level"
- Support tickets about impossible exercises (should decrease)
- Upgrade conversion to Premium (should increase if value is clear)

---

## Open Questions

1. **What if user has minimal equipment?**
   - Show warning: "Limited equipment = fewer workout options"
   - Suggest adding equipment or upgrading to Premium

2. **What if filtering removes too many exercises?**
   - Need minimum threshold (20+ exercises per time domain)
   - If below threshold, relax filters slightly
   - Or show message: "Add equipment for more variety"

3. **Should we save filtered exercise list?**
   - Cache eligible exercises per user
   - Regenerate when profile changes
   - Faster workout generation

4. **Scaling exercises for beginners?**
   - If user is beginner, suggest scaled versions
   - Example: "Try ring rows instead of pull-ups"
   - Or reduce weight/reps automatically

---

## Dependencies

### Code Dependencies:
- ✅ `lib/btn/types.ts` - Already exists
- ✅ `lib/btn/data.ts` - Already has exerciseEquipment
- ✅ `lib/btn/utils.ts` - Needs modifications
- ✅ Database schema - Already has needed tables

### Data Dependencies:
- Skills mapping (exercise name → required skill)
- Movement scaling guide (advanced → beginner versions)
- 1RM to workout weight percentages

---

## Implementation Checklist

- [ ] Add UserProfile interface to types
- [ ] Create loadUserProfile function in BTN page
- [ ] Modify generateTestWorkouts to accept profile
- [ ] Add equipment filtering logic
- [ ] Create skills mapping data
- [ ] Add skills filtering logic
- [ ] Add rep adjustment by skill level
- [ ] Add weight calculation from 1RMs
- [ ] Add "Roll Your Own" toggle UI
- [ ] Add profile link to BTN page
- [ ] Test all filtering scenarios
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add profile refresh button
- [ ] Document for users

---

## Timeline

**Estimated: 5-7 days of focused development**

- Day 1: Load user profile + equipment filtering
- Day 2: Skills mapping + skills filtering
- Day 3: Rep adjustment logic
- Day 4: Weight personalization from 1RMs
- Day 5: UI polish + "Roll Your Own" toggle
- Day 6: Testing + bug fixes
- Day 7: Documentation + deployment

---

## After This is Done

Users will experience:
1. ✅ Open BTN generator
2. ✅ See "Personalized for your equipment" message
3. ✅ Click "Generate 10 Workouts"
4. ✅ Get workouts they can actually do
5. ✅ See appropriate rep ranges for their skill level
6. ✅ See realistic weights based on their maxes
7. ✅ Option to generate random workouts if they want variety
8. ✅ Link to edit profile if equipment/skills change

**This is when BTN becomes truly valuable!**
