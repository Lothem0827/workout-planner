# Home screen plan

The home screen should open on the session you can start. Muscle recovery stays, as a glance, because that is what separates this app from a plain logger.

This follows home screens from Fitbod, Hevy, Ladder, Centr, and Peloton Strength+. Catalog homes (Nike Training Club) and social or coach chrome (Hevy’s feed, Ladder team chat) are out of scope.

## Current home

`app/page.tsx`, inside the mobile shell (`components/shell.tsx`: Home, Workouts, Progress).

1. Today’s date as the page title.
2. A full front/back body map with Fresh, Recovering, and Fatigued.
3. Tapping a muscle inserts a card (last trained, ready in N hours) between the map and the session. That pushes Start down.
4. Below that, one card:
   - No program: “Build a program” → `/train/edit?new=1`.
   - A day picked by `pickToday`: week label, day name, “Day X of Y”, exercise count, **Start**. If a session is already open: **Resume** and **Start again**. Links for “Do another day” and “Fit into the days I have left”.
   - Pass complete: a sentence, no next action.

`pickToday` already chooses the freshest pending slot and marks a day “Not recommended” when a primary muscle is fatigued. The screen does not show the exercises, and Start is not on screen until the map is scrolled past.

## Target

First viewport, top to bottom:

1. **Pass strip.** One cell per non-dropped slot in the current pass: done, today, pending. Today is the slot from `pickToday`. Label cells with the day name (Push, Pull), not Mon–Sun. This app’s pass is an ordered list of days, not a calendar week.
2. **Today’s session.** Day name, “Day X of Y”, week label when the program has weeks, and the “Not recommended” badge when `scoreForSlot` says so. Then the exercise list: name plus sets and rep range, resolved through `gym.map`. Show the full list when it is short; otherwise the first few and a count of the rest.
3. **Start or Resume**, full width. If `activeSessionForSlot` exists, Resume is the primary button and Start again stays secondary. “Do another day” and “Fit into the days I have left” stay as text actions under the button.
4. **Recovery row.** One chip per primary muscle of today’s slot (from `primariesOf` / the same scoring `scoreForSlot` uses): label and Fresh, Recovering, or Fatigued. Tapping a chip opens the existing muscle detail. Tapping “All muscles” opens the full body map.

Start stays reachable. Pin it above the tab bar when the exercise list or the map would push it off screen. The shell already reserves `pb-24` on root tabs.

### Recovery detail

Move muscle detail out of the page flow. Use the same drawer pattern as “Unfinished days”, not a card inserted above Start. Keep the copy already in `MuscleSheet`: muscle name, state, last trained, ready now or ready in about N hours.

The full map keeps the front/back toggle and the three-state legend. It is a drill-in, not the page.

### In progress

When today’s slot has an active session, the session block leads with Resume. The recovery row can stay, under the session. Do not lead with the map.

### Empty and finished

- No program: keep the single “Add a plan” path.
- Pass complete: keep the completion sentence and add one action to start the next pass, using whatever `useGym` already does when a pass ends. If that action does not exist yet, leave the sentence and note it; do not invent a new program flow in this pass.

## Files

- `app/page.tsx` — reorder the home. Session block first, recovery row, pinned action, drawer for muscle detail.
- `components/body-map.tsx` — reuse as-is inside the drill-in. No visual redesign.
- `components/shell.tsx` — only if the pinned button needs a change to the tab-bar offset. Do not add tabs.
- `lib/logic.ts` — reuse `pickToday`, `scoreForSlot`, `recoveryState`, `fatigueScore`, `lastTrained`, `readyInHours`, `activeSessionForSlot`. Add a helper only if the pass strip or the muscle chips need data the page cannot derive cleanly.

No new routes. Workout logging (`app/workout/`), the train editor, and Progress stay as they are.

## Out of scope

- Social feed, streaks, volume widgets, calorie heroes, coach chat.
- Changing how a session is logged, including the rest overlay.
- Replacing the three-tab shell.
- Generating workouts. The plan still comes from the program; recovery only ranks which pending day to offer.

## Done when

- With a program and a pending day, the day name and Start or Resume are visible without scrolling on a phone-width layout (`max-w-md`).
- The exercise names for that day are visible on the home card.
- The pass strip shows done, today, and pending slots.
- Muscle state is visible as chips. The full map and the muscle detail open without moving the Start button.
- An in-progress session shows Resume first.
- No program still has one path to add a plan.
- Home, Workouts, and Progress still share the same gym state.
