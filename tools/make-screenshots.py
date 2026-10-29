# -*- coding: utf-8 -*-
"""Play Store screenshots of the bundled app at exact device pixel sizes, via
headless Edge over CDP (the --screenshot flag no longer writes files here and
Edge keeps an HTTP cache across fresh profiles, so the cache is disabled)."""
import json, pathlib, shutil, subprocess, sys, time, urllib.request
import websocket  # websocket-client

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9333
BASE = "http://localhost:8791/www/index.html"
OUT = pathlib.Path(r"D:\Tolkappiyam app\tholkappiyam-android\store\screenshots")
PROFILE = pathlib.Path(r"C:\Users\Kannan\AppData\Local\Temp\claude\D--DL-file\0c998dea-3384-4a69-bc00-8512341412a6\scratchpad\edge-profile")

# Play classes: phone 9:16, 7-inch 9:16, 10-inch 9:16 (CSS size x device scale)
DEVICES = {
    "phone":    dict(w=360, h=640,  dpr=3),   # 1080 x 1920
    "tablet7":  dict(w=600, h=960,  dpr=2),   # 1200 x 1920
    "tablet10": dict(w=800, h=1280, dpr=2),   # 1600 x 2560
}

class CDP:
    def __init__(self):
        for _ in range(60):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
                page = next(t for t in tabs if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.5)
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], suppress_origin=True)
        self.n = 0
    def call(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.n:
                if "error" in m: raise RuntimeError(m["error"])
                return m.get("result", {})
    def js(self, expr, wait=True):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=wait, returnByValue=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("text"))
        return r.get("result", {}).get("value")
    def shot(self, path):
        data = self.call("Page.captureScreenshot", format="png", captureBeyondViewport=False)["data"]
        import base64; path.write_bytes(base64.b64decode(data))

def ready(c):
    # Page.navigate returns before the new document exists; evaluating into the
    # old context throws while it is being torn down, so keep polling through it.
    time.sleep(0.3)
    for _ in range(150):
        try:
            if c.js("document.documentElement.classList.contains('app-chrome-ready')", wait=False): break
        except RuntimeError:
            pass
        time.sleep(0.1)
    try: c.js("document.fonts.ready.then(()=>true)")
    except RuntimeError: pass
    time.sleep(0.4)

SLEEP = "new Promise(r=>setTimeout(r,%d))"
def wait(c, ms): c.js(SLEEP % ms)

def open_iyal(c, a, i):
    c.js("document.getElementById('menuBtn').click()", wait=False); wait(c, 250)
    c.js(f"document.querySelector('#tree .iyal[data-a=\"{a}\"][data-i=\"{i}\"]').click()", wait=False); wait(c, 600)
    c.js("window.scrollTo(0,0)", wait=False); wait(c, 200)

def main():
    if PROFILE.exists(): shutil.rmtree(PROFILE)
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
                             f"--remote-debugging-port={PORT}", f"--user-data-dir={PROFILE}",
                             "--autoplay-policy=no-user-gesture-required", "--mute-audio", "--lang=ta",
                             "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        c = CDP()
        c.call("Page.enable"); c.call("Runtime.enable"); c.call("Network.enable")
        c.call("Network.setCacheDisabled", cacheDisabled=True)
        for name, d in DEVICES.items():
            out = OUT / name; out.mkdir(parents=True, exist_ok=True)
            c.call("Emulation.setDeviceMetricsOverride", width=d["w"], height=d["h"],
                   deviceScaleFactor=d["dpr"], mobile=True)
            c.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-color-scheme", "value": "light"}])
            # seed cues for நூன் மரபு so the highlight shot is the real mechanism
            c.call("Page.navigate", url=BASE + "?s=0"); ready(c)
            c.js("localStorage.clear(); localStorage.setItem('tk_audio_cues', JSON.stringify({'003-eluttu-noon-marabu':[[1,0],[2,18],[3,36],[4,58],[5,80]]})); true", wait=False)
            c.call("Page.navigate", url=BASE + "?s=1"); ready(c)

            c.shot(out / "01-landing.png")

            open_iyal(c, 0, 0)
            c.shot(out / "02-reading.png")

            c.js("var s=document.getElementById('search'); s.value='திணை'; s.dispatchEvent(new Event('input',{bubbles:true})); true", wait=False)
            wait(c, 500); c.js("window.scrollTo(0,0)", wait=False); wait(c, 150)
            c.shot(out / "03-search.png")
            c.js("var s=document.getElementById('search'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); true", wait=False); wait(c, 400)

            # recitation playing with the current நூற்பா lit
            open_iyal(c, 0, 0)
            c.js("document.querySelector('#main .iyal-audio button').click(); true", wait=False); wait(c, 1500)
            # No Range support on the dev server, so a seek never sticks in headless
            # Edge. Play from the start instead: the first cue is at 0 s, so நூற்பா 1
            # is lit genuinely; frame that card just below the sticky header.
            wait(c, 1800)
            c.js("var k=document.getElementById('n-0-0-1'); if(k){window.scrollTo(0, k.getBoundingClientRect().top + window.scrollY - 200);} true", wait=False)
            wait(c, 600)
            c.shot(out / "04-recitation.png")
            # later shots should not carry a paused player around
            c.js("document.querySelector('.apl-close').click(); true", wait=False); wait(c, 300)

            c.js("document.getElementById('menuBtn').click(); true", wait=False); wait(c, 400)
            c.shot(out / "05-contents.png")
            c.js("if(typeof closeSide==='function')closeSide(); true", wait=False); wait(c, 300)

            c.js("document.querySelector('.appnav [data-nav=\"learn\"]').click(); true", wait=False); wait(c, 700)
            c.js("window.scrollTo(0,0)", wait=False); wait(c, 150)
            c.shot(out / "06-learn.png")

            c.js("document.querySelector('.appnav [data-nav=\"games\"]').click(); true", wait=False); wait(c, 700)
            c.js("window.scrollTo(0,0)", wait=False); wait(c, 150)
            c.shot(out / "07-games.png")

            c.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-color-scheme", "value": "dark"}])
            wait(c, 300); open_iyal(c, 1, 0)
            c.shot(out / "08-dark.png")
            print(name, "done")
    finally:
        proc.kill()
    from PIL import Image
    for p in sorted(OUT.rglob("*.png")):
        im = Image.open(p); print(f"{p.parent.name}/{p.name}: {im.size[0]}x{im.size[1]}")

if __name__ == "__main__":
    main()
