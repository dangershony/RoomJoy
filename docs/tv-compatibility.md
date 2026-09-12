# TV compatibility (unverified checks)

These are **checklist items**, not lab-verified results. Validate on target living-room hardware before launch.

## Browsers / platforms to spot-check

- [ ] Samsung Tizen (recent Smart Hub browser)
- [ ] LG webOS browser
- [ ] Android TV / Google TV Chrome
- [ ] Apple TV via AirPlay / mirrored Safari (if used)
- [ ] Desktop Chrome / Edge / Firefox / Safari (dev stand-in)

## Functional checks

- [ ] Large type readable from ~3m (room code, host code, lobby names)
- [ ] High contrast (light text on dark background)
- [ ] QR code scan from phone camera at typical couch distance
- [ ] WebSocket stays up for 30+ minutes
- [ ] Audio unlock after **Start** gesture (autoplay policies)
- [ ] Touch not required for TV path (remote / click OK)
- [ ] `prefers-reduced-motion` reduces canvas interpolation smoothing
- [ ] No reliance on camera, mic, sensors, or PWA install

## Known M1 constraints

- No PWA / service worker.
- No fullscreen API requirement (optional later).
- Join links must use a phone-reachable host (LAN IP or tunnel), not only `localhost`, when phones are physical devices.
