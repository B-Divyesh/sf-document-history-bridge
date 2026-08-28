# Demo sandbox

- URL: `https://document-history-bridge.sociobot.in/demo/` (local: `http://127.0.0.1:4173/demo/`).
- One-click entry: **Try it with sample data** is visible on the landing page’s first screen.
- Sample project: `Client records`, with two snapshots each for `Proposal.docx`, `Records-policy.odt`, and `Meeting-notes.md`.
- Try: select a file, select a date, read the added and removed words, then use **Restore this sample version**.
- Reset: **Reset demo** returns to the latest `Proposal.docx` snapshot.
- Leave: **Start for real** clears demo state and opens the real download section.
- Isolation: only the `demo:document-history-bridge:selection` key is used. No native file APIs, real archive commands, accounts, or remote data calls are available in the browser demo.
- Desktop first run also offers **Load sample project**. Its sample is held in memory and never calls the native archive commands.
