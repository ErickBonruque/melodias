"""Apoio para os testes visuais: abre o app, junta erros do console e salva screenshots."""
from contextlib import contextmanager
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

URL = "http://localhost:5173"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)


@contextmanager
def studio(width=1366, height=768, theme=None, fresh=True, fake_mic=None):
    """Abre o estúdio num Chromium headless. Com fresh=True começa sem nada salvo.

    fake_mic: caminho de um WAV que o navegador entrega como se fosse o microfone, em laço.
    """
    with sync_playwright() as p:
        args = ["--autoplay-policy=no-user-gesture-required"]
        if fake_mic:
            args += [
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                f"--use-file-for-fake-audio-capture={fake_mic}",
            ]
        browser = p.chromium.launch(headless=True, args=args)
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
            permissions=["microphone"] if fake_mic else [],
        )
        page = context.new_page()
        errors = []
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        if theme:
            page.evaluate("t => window.__melodias.view.getState().set({ theme: t })", theme)
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(250)
        try:
            yield page, errors
        finally:
            if errors:
                print("--- console ---")
                for e in errors:
                    print(e)
            else:
                print("console limpo")
            browser.close()


def shot(page: Page, name: str) -> str:
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path))
    print("screenshot:", path)
    return str(path)


def point(page: Page, tick: int, pitch: int):
    """Coordenadas de tela de um ponto da grade (tick, altura MIDI)."""
    pt = page.evaluate("([t, p]) => window.__roll.pointFor(t, p)", [tick, pitch])
    return pt["x"], pt["y"]


def click_grid(page: Page, tick: int, pitch: int, **kw):
    x, y = point(page, tick, pitch)
    page.mouse.click(x + 3, y, **kw)


def notes(page: Page):
    return page.evaluate(
        "window.__melodias.doc.getState().melody.notes.map(n => ({pitch: n.pitch, start: n.start, duration: n.duration}))"
    )
