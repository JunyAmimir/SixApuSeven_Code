# Working directly in your VS Code project

This folder is now the active project. Changes are saved directly here; you do not need to download a new ZIP for each update.

## Run the app

Double-click **Start_FlowPulse.cmd**. The launcher starts the server and opens the correct local address only after it is ready. Keep its window open while you use the app. Normal startup does not ask for a camera key.

If this same project is already running, the launcher reopens it instead of starting a duplicate. If another project is using port 8000, it selects an available port and prints the correct address.

You can use the address in VS Code's integrated browser too. Refresh that browser after changes. The login page needs the local server; keeping a previously loaded page open does not keep the server running.

Credentials are unchanged; see DEMO_ACCOUNTS.md. Camera setup can be added later using GEMINI_API_KEY or `python launcher.py --camera`.
