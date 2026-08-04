# Nova Tetris

A polished browser-based Tetris experience built with vanilla HTML, CSS, and JavaScript.

## Run locally

Open [index.html](index.html) directly in a browser, or serve the folder with a simple static server such as:

```bash
python -m http.server 8000
```

Then visit [http://localhost:8000/](http://localhost:8000/).

## Why this stack

- Vanilla web technologies keep the game portable and easy to run locally without any backend or paid services.
- The game logic is separated from the UI so it can be tested independently.
- Responsive CSS ensures the playfield remains readable on desktop and mobile screens.

## Known limitations

- The implementation focuses on the required core Tetris mechanics rather than advanced rules such as T-spins or back-to-back bonuses.
- Ranking is stored in local browser storage only.
