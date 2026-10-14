"""Gera os prints do README em docs/screenshots. Não faz parte da bateria de testes.

Uso: with_server.py --server "npm run dev" --port 5173 -- python tests/visual/prints.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://localhost:5173"
OUT = Path(__file__).resolve().parents[2] / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
Q = 480


def melody(title, key, scale, bpm, ts, tags, phrase):
    """phrase: lista de (altura MIDI, início em tempos, duração em tempos)."""
    return {
        "title": title, "key": key, "scale": scale, "bpm": bpm, "timeSignature": ts, "tags": tags,
        "notes": [{"pitch": p, "start": round(s * Q), "duration": round(d * Q), "velocity": v}
                  for p, s, d, v in [(x + (0.8,))[:4] for x in phrase]],
    }


NOTURNO = melody("Noturno de bolso", "A", "minor", 76, [4, 4], ["noturno", "piano"], [
    (69, 0, 1), (72, 1, .5), (76, 1.5, .5), (74, 2, 1), (72, 3, .5), (71, 3.5, .5),
    (72, 4, 1.5), (69, 5.5, .5), (67, 6, 1), (64, 7, 1),
    (65, 8, .5), (69, 8.5, .5), (72, 9, .5), (77, 9.5, .5), (76, 10, 1), (74, 11, .5), (72, 11.5, .5),
    (71, 12, 1), (68, 13, .5), (71, 13.5, .5), (69, 14, 2),
])
VALSA = melody("Valsa da garoa", "D", "dorian", 132, [3, 4], ["valsa"], [
    (62, 0, 1), (65, 1, 1), (69, 2, 1), (71, 3, 2), (69, 5, 1), (67, 6, 1), (65, 7, 1), (64, 8, 1), (62, 9, 3),
])
BAIAO = melody("Baião torto", "G", "mixolydian", 104, [2, 4], ["baião", "ideia"], [
    (67, 0, .75), (67, .75, .25), (71, 1, .5), (74, 1.5, .5), (77, 2, .75), (76, 2.75, .25), (74, 3, .5), (71, 3.5, .5),
    (72, 4, .75), (72, 4.75, .25), (69, 5, .5), (67, 5.5, .5), (65, 6, .75), (67, 6.75, 1.25),
])

LOAD = """m => {
  const s = window.__melodias
  const id = () => crypto.randomUUID()
  const now = Date.now()
  s.doc.getState().load({ id: id(), instrument: 'piano', createdAt: now, updatedAt: now, ...m,
    notes: m.notes.map(n => ({ id: id(), ...n })) })
  s.doc.getState().setMeta({ title: m.title })
}"""


def center_on(page, pitch):
    box = page.locator("canvas").bounding_box()
    cy = box["y"] + box["height"] / 2
    y = page.evaluate("p => window.__roll.pointFor(0, p).y", pitch)
    page.mouse.move(box["x"] + box["width"] / 2, cy)
    page.mouse.wheel(0, y - cy)
    page.wait_for_timeout(600)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 810}, device_scale_factor=2)
    page = context.new_page()
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    page.evaluate("window.__melodias.view.getState().set({ pxPerBeat: 50, rowH: 20 })")

    for m in (VALSA, BAIAO, NOTURNO):
        page.evaluate(LOAD, m)
        page.wait_for_timeout(900)  # autosave grava na biblioteca

    # 1. tema escuro, tocando com acordes e partitura: cursor, tecla acesa, cifra e figura da vez
    page.mouse.click(700, 500)  # um clique libera o áudio
    page.keyboard.press("Control+z")
    page.wait_for_function("window.__melodias.transport.getState().loadingInstrument === null", timeout=15000)
    page.keyboard.press("Escape")
    page.get_by_role("tab", name="Harmonia").click()
    page.get_by_role("button", name="Sugerir acordes para a melodia").click()
    page.get_by_role("button", name="Partitura").click()
    page.wait_for_selector(".score svg .abcjs-note", timeout=15000)
    center_on(page, 70)
    page.mouse.move(1300, 500)
    page.keyboard.press("Space")
    page.wait_for_function("window.__melodias.engine.position() > 480 * 9.72", timeout=20000)
    page.screenshot(path=str(OUT / "estudio-escuro.png"))
    page.keyboard.press("Enter")
    page.keyboard.press("Enter")
    page.get_by_role("button", name="Partitura").click()
    page.get_by_role("button", name="Tirar os acordes").click()
    page.get_by_role("tab", name="Notas").click()
    center_on(page, 70)
    page.wait_for_timeout(300)

    # 2. tema claro, com um trecho selecionado
    page.get_by_label("Alternar tema claro e escuro").click()
    ids = page.evaluate("window.__melodias.doc.getState().melody.notes.slice(10, 17).map(n => n.id)")
    page.evaluate("ids => window.__melodias.doc.getState().select(ids)", ids)
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / "estudio-claro.png"))
    page.evaluate("window.__melodias.doc.getState().select([])")
    page.get_by_label("Alternar tema claro e escuro").click()

    # 3. aba Criar: gerador de ideias, variações, gravar e cantarolar
    page.locator("aside[aria-label=Biblioteca] li", has_text="Baião torto").click()
    page.wait_for_timeout(400)
    center_on(page, 71)
    page.get_by_role("tab", name="Criar").click()
    x = page.evaluate("window.__roll.pointFor(480 * 2.3, 77)")
    page.mouse.move(x["x"], x["y"])
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / "criar.png"))
    page.get_by_role("tab", name="Notas").click()

    # 4. atalhos
    page.keyboard.press("?")
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "atalhos.png"))
    browser.close()

for f in sorted(OUT.glob("*.png")):
    print(f.name, f.stat().st_size // 1024, "KB")
