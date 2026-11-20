# 反方向紅綠燈

Silent portrait mini-game. A block drives itself toward the finish. Hold to brake, release to move. The light switches between red and green, and the rule flips between “green means go” and “red means go”.

One round is 30 seconds. The card says 正常：綠行、紅停, or flips to 反轉：紅行、綠停 when the rule actually changes. Yellow is a half-second preview and may say a change is coming; either action is allowed while it is on. A lock covers the card and keeps the hand position you already had until the countdown ends. The clock keeps running. Coming back from a pause gives a short grace to match the lock or the lights again.

## Controls

- Phone or mouse: hold the road or the big 按住煞車 pad. Release to move.
- Keyboard: hold Space to brake. Esc pauses. Space or Enter resumes, or starts 再來一局 from the result.
- Leaving the tab or the window pauses the round and releases the brake. Tap 繼續 to resume. The block stays still through a short grace so coming back is not an instant out.

Scores stay in this browser (`localStorage`, key `reverse-traffic-v1`). If storage is blocked, the best result lasts only for the current visit.

## Pages

Static files only. Asset paths are relative, so the site works at a project-page prefix such as `/Reverse-Traffic/`.

The interface uses a subset of Noto Sans TC, licensed under the SIL Open Font License (`fonts/OFL.txt`).
