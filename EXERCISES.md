# Educational Mini Exercises Feature

## Overview

The mini exercises feature provides interactive, touch-based educational games that help girls earn stars while improving their spelling, grammar, and arithmetic skills. All content is in Greek (Modern Greek) to match the application's primary language.

## Features

### Exercise Types

1. **Spell-Fill (Συμπλήρωση Λέξεων)**
   - Fill in missing letters in Greek words
   - Hints provided for each word
   - Touch-friendly letter input boxes
   - Example: "ΣΧΟΛΕΙΟ" with letters hidden at specific positions

2. **Grammar-Choice (Γραμματική)**
   - Multiple choice grammar questions
   - Touch-friendly option buttons
   - Focus on verb conjugation and syntax
   - Example: "Η Ηλέκτρα ___ στο σχολείο" with options

3. **Math-Simple (Απλή Αριθμητική)**
   - Basic arithmetic operations: +, -, ×, ÷
   - Horizontal equation format
   - Number input for answers
   - Example: "3 + 5 = ?"

4. **Math-Vertical (Κάθετη Αριθμητική)**
   - Vertical arithmetic layout (more visual)
   - Addition and subtraction only
   - Touch-friendly for young learners
   - Example:
     ```
       23
     + 45
     ----
       ?
     ```

### Difficulty Levels

- **Easy (Εύκολο)**: 5-7 stars, simple concepts
- **Medium (Μέτριο)**: 7-9 stars, moderate difficulty
- **Hard (Δύσκολο)**: 9-10 stars, challenging problems

### Gameplay

1. User selects which girl wants to play
2. Available exercises are shown grouped by difficulty
3. Each exercise allows up to 3 attempts
4. Correct answer awards stars immediately
5. Failed exercises can be retried later
6. Completed exercises are hidden from the list

## Data Structure

### Exercise Definition (data.json)

```json
{
  "id": "spell-1",
  "title": "Συμπλήρωσε τη λέξη: ΣΧΟΛΕΙΟ",
  "icon": {
    "type": "emoji",
    "value": "✏️"
  },
  "difficulty": "easy",
  "stars": 5,
  "content": {
    "type": "spell-fill",
    "word": "ΣΧΟΛΕΙΟ",
    "hiddenIndices": [2, 5],
    "hint": "Πάμε εκεί κάθε μέρα για να μάθουμε"
  },
  "eligibleUsers": ["u1", "u2"]
}
```

### Exercise Types in TypeScript

```typescript
export type ExerciseType = 'spell-fill' | 'grammar-choice' | 'math-simple' | 'math-vertical';
export type ExerciseDifficulty = 'easy' | 'medium' | 'hard';

export interface Exercise {
  id: string;
  title: string;
  icon: IconValue;
  difficulty: ExerciseDifficulty;
  stars: number;
  content: ExerciseContent;
  eligibleUsers?: string[];
}

export interface ExerciseInstance {
  id: string;
  exerciseId: string;
  userId: string;
  status: 'available' | 'active' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  attempts: number;
  starsAwarded?: number;
}
```

## API Endpoints

### GET /api/exercises
Get all exercises with optional user filtering.

**Query Parameters:**
- `userId` (optional): Filter exercises by user eligibility

**Response:**
```json
{
  "exercises": [...],
  "instances": [...]
}
```

### POST /api/exercises/:exerciseId/start
Start an exercise for a specific user.

**Body:**
```json
{
  "userId": "u1"
}
```

**Response:** `ExerciseInstance`

### POST /api/exercises/:instanceId/submit
Submit an answer for validation.

**Body:**
```json
{
  "answer": "ΣΧΟΛΕΙΟ" // or number for math, or index for grammar
}
```

**Response:**
```json
{
  "instance": {...},
  "correct": true
}
```

### POST /api/exercises/:instanceId/abandon
Abandon an active exercise (marks as failed).

**Response:** `ExerciseInstance`

## UI Components

### ExercisesDrawer
Main container component that manages exercise selection and gameplay.

**Props:**
- `isOpen: boolean` - Controls drawer visibility
- `onClose: () => void` - Callback when drawer closes

### Game Components
Each exercise type has its own specialized game component:
- `SpellFillGame` - Letter input with auto-focus
- `GrammarChoiceGame` - Multiple choice buttons
- `MathSimpleGame` - Horizontal equation with number input
- `MathVerticalGame` - Vertical arithmetic layout

### ExercisePlayer
Wrapper component that handles exercise submission, feedback, and navigation.

## Accessing Exercises

Users access exercises through:
1. A floating action button (🎓) on the Dashboard
2. The button appears at the right side of the screen
3. Only visible when no routines are active

## Sample Exercises Included

The `data.json` file includes 13 sample exercises:
- 3 spelling exercises (ΣΧΟΛΕΙΟ, ΒΙΒΛΙΟ, ΟΙΚΟΓΕΝΕΙΑ)
- 3 grammar exercises (verb conjugation, prepositions)
- 4 math-simple exercises (addition, subtraction, multiplication, division)
- 3 math-vertical exercises (various difficulties)

## Adding New Exercises

To add new exercises:

1. Edit `backend/data.json`
2. Add a new exercise object to the `exercises` array
3. Follow the schema defined in `backend/data.schema.json`
4. Ensure Greek language content
5. Test the exercise through the UI

Example:
```json
{
  "id": "spell-4",
  "title": "Συμπλήρωσε τη λέξη: ΦΙΛΟΣ",
  "icon": {
    "type": "emoji",
    "value": "✏️"
  },
  "difficulty": "easy",
  "stars": 5,
  "content": {
    "type": "spell-fill",
    "word": "ΦΙΛΟΣ",
    "hiddenIndices": [1, 3],
    "hint": "Κάποιος που αγαπάμε και παίζουμε μαζί"
  }
}
```

## Future Enhancements

Potential improvements:
- Timed exercises for bonus stars
- Daily exercise challenges
- Progress tracking and statistics
- More exercise types (matching, ordering, etc.)
- Adaptive difficulty based on performance
- Sound effects and animations for feedback
- Leaderboards for friendly competition

## Technical Notes

### State Management
- Exercise state is stored in `globalState.exerciseInstances`
- Persisted to `state.json` on disk
- Synced via WebSocket for real-time updates

### Validation
- Answer validation happens server-side in `db.ts`
- Each exercise type has custom validation logic
- Math operations support floating-point comparison

### Touch Optimization
- Large touch targets (minimum 44px)
- Auto-focus for sequential inputs
- Tap feedback with framer-motion
- Disabled double-tap zoom where appropriate

### Accessibility
- Semantic HTML structure
- Clear visual feedback
- Readable font sizes (min 16px)
- High contrast colors

## Troubleshooting

### Exercises not appearing
- Check `eligibleUsers` array in exercise definition
- Verify user has not already completed the exercise
- Check browser console for errors

### Submission not working
- Ensure backend is running
- Check network tab for API errors
- Verify answer format matches exercise type

### Stars not awarded
- Check backend logs for validation errors
- Verify exercise instance status in state.json
- Ensure user exists in data.json
