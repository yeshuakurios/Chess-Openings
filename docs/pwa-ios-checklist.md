# iOS install and offline checklist
1. Open the deployed site in Safari, Share → Add to Home Screen. Launch from the icon (standalone, no Safari bars).
2. Open each opening once online so the service worker caches the app.
3. Turn on Airplane Mode, force-quit the app, relaunch: Home, Learn, Practice and Drill must all work.
4. Check the safe areas: nothing hidden under the notch or home bar.
5. Play a line with a wrong move: board snaps back and shows "That move isn't part of this line."
6. Settings → Export progress; confirm the clipboard copy and that Import restores it.
7. After a deploy, reopen the app twice (the service worker updates on the second launch).
Note: iOS can clear site storage for apps unused for a long time, so export progress now and then (D1 sync will replace this).
