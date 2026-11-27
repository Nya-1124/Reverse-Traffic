# 反方向紅綠燈

Silent portrait mini-game. A block drives itself toward the finish. Hold to brake, release to move. The light switches between red and green, and the rule flips between “green means go” and “red means go”.

Choose 正常燈, 反轉, 燈壞了, 混合挑戰, or 突發事件 for a 30-second run. 終極混合 deals a new 40-second course every run, mixing a random handful of rule flips, broken lights, and emergencies. 終極挑戰 is a harder 60-second course: more flips, broken lights, and emergencies, shorter yellow, and a tighter distance. Each fresh entry starts with a short practice. 跳過教學 starts the timed run immediately. 再來一局 restarts that run. 重看教學 plays the practice again. The card says 正常：綠行、紅停, or flips to 反轉：紅行、綠停 when the rule changes. When the lights break, the whole signal head gets a red dashed edge. There is no countdown. After a short moment the game keeps whatever you were doing: moving stays moving, stopped stays stopped. The lamps keep changing and stay visible; only that captured state is enforced until the red edge goes away, then a short grace. 突發事件 adds sudden stops: 阿婆跌橙, 蜘蛛俠互指, and 季候風. Coming back from a pause gives a short grace.

## Controls

- Phone or mouse: hold the road or the big 按住煞車 pad. Release to move.
- Keyboard: hold Space to brake. Esc pauses. Space or Enter resumes, or starts 再來一局 from the result.
- Leaving the tab or the window pauses the round and releases the brake. Tap 繼續 to resume. The block stays still through a short grace so coming back is not an instant out.

Scores stay in this browser (`localStorage`, key `reverse-traffic-v1`). If storage is blocked, the best result lasts only for the current visit.

## Pages

Static files only. Asset paths are relative, so the site works at a project-page prefix such as `/Reverse-Traffic/`.

The interface uses a subset of Noto Sans TC, licensed under the SIL Open Font License (`fonts/OFL.txt`).
