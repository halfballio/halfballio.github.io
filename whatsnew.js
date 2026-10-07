// The build number and the release notes (the What's new card). The pre-commit hook bumps BUILD here.
const BUILD = 536;   // one per commit to main (shown on the title screen and under the table)
export const VERSION = '1.' + BUILD, CONTACT = 'hello@halfball.io';   // shown as 1.<build>, with the contact address
export const SOURCE = 'https://github.com/halfballio/halfballio.github.io/tree/main';   // the build links to the code it was made from

// ---------- What's new: release notes by build, newest first ----------
// The routine: each time a player-facing change ships, add an entry at the TOP for that build (the BUILD it ships in: the
// pre-commit hook adds one, so that's the current BUILD + 1), or extend the top entry if it's still that build or the same
// day's run of builds (raise `build` to the latest). One plain line per change, in the player's words: what they'll notice,
// not how it works. Keep it to 2–4 lines; leave out fixes nobody would see. Shown as "1.<build>"; the date is kept in the list but not shown.
// A returning player sees the builds since the one they last saw, once, at a calm moment; then the dot on ? clears.
// A new player starts with everything seen. The whole list is always under ? › What's new.
export const WHATS_NEW = [
  {build: 536, date: '2026-10-07', title: 'Fixes', items: [
    'The cue strike sounds as the tip meets the ball, not a moment after.',
    'Bug fixes and small improvements.',
  ]},
  {build: 519, date: '2026-10-06', title: 'Fixes', items: [
    'Bug fixes and small improvements.',
  ]},
  {build: 516, date: '2026-10-06', title: 'New ball finishes', items: [
    'Each ball set now has its own finish. Retro has a satin look with classic numbers, TV is glossier with larger numbers, and Standard has crisp new numbers.',
    'Bug fixes and small improvements.',
  ]},
  {build: 515, date: '2026-10-06', title: 'Practice, Run-outs and more', items: [
    'Practice opens at B-. Choose the fractions, angle, side and distance you want to work on, or let the game pick your weakest shots. Practice shots are not scored.',
    'Run-outs opens at S. Plan a rack of three to nine balls by choosing each ball and its pocket, then run it from wherever the cue ball stops. Racks can be open, 8-ball last or rotation.',
    'The Look button on the table changes the table style and the balls.',
    'Levelling up now shows what the new grade focuses on and what it unlocks.',
    'You can back up your progress to a file and restore it in any browser, and Stats now count every shot you have played.',
    'The English lesson now explains deflection and lets you try allowing for it.',
    'Bug fixes and small improvements.',
  ]},
  {build: 508, date: '2026-10-06', title: 'Lessons show you the right shot', items: [
    'Call a lesson shot wrong and you see it played right, then it’s yours to call again.',
    'A lesson step with nothing to call leaves the table as it is, and its fractions stand back: Enter, or Done, moves you on.',
  ]},
  {build: 507, date: '2026-10-06', title: 'One right shot', items: [
    'The result card names one right shot, the call, stroke and spin that Replay the right shot plays, and the replay lights up that same fraction.',
    'A call that was right for the stroke and spin you chose is no longer marked wrong: the card says it fits, and shows the right shot beside it.',
  ]},
  {build: 506, date: '2026-10-06', title: 'The right stroke, shown right', items: [
    'A stroke that drops the ball but scratches now counts as the wrong stroke, and the card names the one that drops it clean.',
    'Replay the right shot plays the stroke and spin the card names, and it always drops clean, english shots included.',
    'Every line of the result, and a lesson’s note, is coloured by its own outcome: a pocketed ball in the zone is always green.',
  ]},
  {build: 504, date: '2026-10-05', title: 'A shorter ladder', items: [
    'The ladder ends at S. One grade that repeated another is gone, and every grade after it moved down one.',
    'You keep your progress: your grade shows the same skill under its new letter.',
    'Streaks: the confetti, glow and logo pulse stay; the sparks from the pocket are gone.',
  ]},
  {build: 501, date: '2026-10-05', title: 'The focus button, redrawn', items: [
    'The focus button is simpler: a ring with a red dot while the view turns round the cue ball, no dot for the object ball.',
  ]},
  {build: 499, date: '2026-10-05', title: 'Stats, properly', items: [
    'A Stats button in the header opens your stats full screen.',
    'Accuracy over time, which fractions you mix up, and whether you cut too thin or too thick.',
    'Zones, speed, spin and scratches, plus your streaks and sessions.',
  ]},
  {build: 497, date: '2026-10-05', title: 'The focus button', items: [
    'A new button next to the eye swaps the view\'s centre between the cue ball and the object ball. V does the same.',
    'Its face shows the ball you\'re looking around.',
    'Tapping a ball no longer moves the view.',
  ]},
  {build: 494, date: '2026-10-05', title: 'Look around any ball', items: [
    'Tap or click a ball and dragging turns the view around it. Tap the cue ball, or press V, to come back.',
    'Calling, getting down and shooting always return to the cue ball\'s view.',
    'Lesson 1 shows you how, in two short new steps.',
    'Phones: the arrow over a far pocket leans in so it stays in view.',
    'What\'s new: this list. It opens once when there\'s something new, and any time from ?.',
  ]},
  {build: 492, date: '2026-10-05', title: 'Streaks, sooner', items: [
    'The sparks, glow and confetti for a streak shot now come with the chime as you call it, not after the ball stops.',
    'Phones: smoothing (antialiasing) starts off, so the table runs lighter. Turn it back on in Settings.',
    'Flash on phones: the display time sits beside the mode switch, so the whole shot fits the screen.',
  ]},
  {build: 486, date: '2026-10-05', title: 'A clearer result card', items: [
    'The card is ready before you call and fills in place, so nothing jumps.',
    'The verdict comes first, large. Each value gets a check or a cross, with the right value beside yours when they differ.',
    'Your streak count now lives in the logo, top left.',
    'Thin cuts come up near the pocket, not from across the table.',
  ]},
  {build: 483, date: '2026-10-05', title: 'Shots in reach, and a new radio', items: [
    'The cue ball is always within reach from the rail: no more reading a shot from the far end of the table.',
    'The radio on the table is new: tap it to change station. Music starts off.',
    'Flash: Replay on the call card works again.',
    'Phones: the title screen opens at the top, and the first-launch stance card fits the screen.',
  ]},
  {build: 473, date: '2026-10-04', title: 'Better on phones', items: [
    'Bigger controls on the table, with a tip and speed readout above your finger.',
    'The header fits one row, and the game fits the screen with the phone on its side.',
    'Replay shows the tip, speed and fraction of the shot being replayed.',
    'Opens offline, and opens quickly on a slow connection.',
  ]},
];
export const notesTop = Math.max(BUILD, ...WHATS_NEW.map(e=>e.build));
