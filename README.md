# MEMORY//VOID — The Last Lullaby

**The universe has gone silent. Somewhere in its ruins, your sister is still trying to say your name.**

A cinematic WebGL 2 flight through three collapsing realities, rendered with Three.js, real perspective geometry, and bloom. Pilot Mara Venn and the ship *Lark* chase a voice across the Glass Meridian, the Cathedral of Tides, and the White Static. Recover memory fragments, survive each world, then break the boss's shield and fire into its exposed core.

## Play

- **WASD / arrow keys:** fly in 3D
- **J:** fire pulse
- **Space:** phase shift through danger
- **Escape:** pause
- **Left click:** fire pulse (optional)

The game includes an original cinematic title image, a 3D ship and boss models, depth-based hazards and pickups, three chapter palettes and environments, story interludes, three boss encounters with changing attack patterns, chapter progress saves, 3D particles, bloom lighting, and a layered synthesized soundtrack with reactive effects. Audio is generated locally; the game needs no sound downloads.

## Gemini Dreamwright (optional)

Enter a Gemini API key in the title screen and describe a world. Gemini invents its palette, name, omen, and a flight modifier for the campaign. The key is stored locally on this device and sent directly to Google's Gemini API when requested. Story mode works without Gemini or an account.

## Run from source

Requires Node.js 22 or newer.

```sh
npm ci
npm start
```

## Build the Windows installer

```sh
npm run dist:win
```

The installer is written to `dist/`. GitHub Actions builds the installer on each `v*` tag and attaches the `.exe` to that GitHub Release. Push this repository to GitHub, then push a tag such as `v0.3.0` to publish a downloadable installer.

The current release target is Windows x64 with WebGL 2 support. The installer is not code-signed, so Windows may display an unknown-publisher notice.

## Output:
<img width="1917" height="907" alt="image" src="https://github.com/user-attachments/assets/37dff7f2-ee90-4257-91c2-e9fe34417640" />


## Small Game Play

https://lnkd.in/p/d4xy3hkq

