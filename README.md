# Day one, day seven

[![make.fun](https://make.fun/badge/post-tiktok-day-one-day-seven-20261123-0327.svg)](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327)
[![rank](https://make.fun/badge/post-tiktok-day-one-day-seven-20261123-0327/donatfarm01/day-one-day-seven/rank.svg)](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327)
[![reward](https://make.fun/badge/post-tiktok-day-one-day-seven-20261123-0327/donatfarm01/day-one-day-seven/reward.svg)](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327)

Entry for the make.fun bounty **"Day one, day seven"**.

## The video

One tiny game — **Starfall**, a vertical arcade catcher: steer a basket,
catch falling stars, miss three and the run ends. The video cuts between the
same game at two moments a week apart, with the camera still so the changes
tell the story:

- **Day 1** — bare slate-grey sky, one star at a time, plain white score,
  no particles, no combo, no levels.
- **Day 7** — same map, same opening (identical first star, identical basket
  start), but a deep indigo night sky with a twinkling starfield and drifting
  clouds, up to five stars at once, golden bonus coins, a combo counter,
  particle bursts, a shield pickup and a "LEVEL 2 — DOUBLE STARS" banner.

It closes on the day-seven build being played, an invitation to start your
own at make.fun, and make.fun's referral end card with our referral code.

The video is posted on TikTok by
[@zhiver_04](https://www.tiktok.com/@zhiver_04); this repository holds
`VIDEO.json` with the video's address, and `main.ts` copies it to `/output`
(the house reads the video itself from TikTok).

## The game

`game/starfall.html` is the playable game — open it in a browser, steer with
arrow keys, mouse or touch. `?day=1` loads the day-one build,
`?day=7` (default) the day-seven build. `game/render-game.mjs` is the
headless renderer that produced the video's gameplay footage: the same seeded
simulation (`mulberry32(1337)`), the same first-three-spawn schedule in both
builds, and a basket that steers toward the lowest falling star — slower on
day one (500 px/s), faster on day seven (900 px/s).

## Run it locally

    mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

`out/VIDEO.json` is then byte for byte this directory's `VIDEO.json`.
