# 反方向紅綠燈

Silent portrait mini-game. A block drives itself toward the finish. Hold to brake, release to move. The light switches between red and green, and the rule flips between “green means go” and “red means go”.

One round is 30 seconds. Moving when the current rule says stop is an out. Braking the whole time never reaches the finish. Before each change the lamp turns yellow for half a second: braking or moving is allowed, the sign says what comes next (including a rule flip), and the clock keeps running. When the yellow ends, the new light is enforced immediately. Coming back from a pause still has its own short grace.

## Controls

- Phone or mouse: hold the road or the big 按住煞車 pad. Release to move.
- Keyboard: hold Space to brake. Esc pauses. Space or Enter resumes, or starts 再來一局 from the result.
- Leaving the tab or the window pauses the round and releases the brake. Tap 繼續 to resume. The block stays still through a short grace so coming back is not an instant out.

Scores stay in this browser (`localStorage`, key `reverse-traffic-v1`). If storage is blocked, the best result lasts only for the current visit.

## Pages

Static files only. Asset paths are relative, so the site works at a project-page prefix such as `/Reverse-Traffic/`.

The interface uses a subset of Noto Sans TC, licensed under the SIL Open Font License (`fonts/OFL.txt`).
