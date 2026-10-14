"""Fumaça no build de produção (npm run build && npm run preview): abre, toca, desenha a partitura e transcreve.

Aqui não existem os ganchos de desenvolvimento, então tudo é feito pela interface.
Uso: with_server.py --server "npm run preview -- --port 4173 --strictPort" --port 4173 -- python tests/visual/prod_smoke.py
"""
import importlib.util
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

here = Path(__file__).parent
wav = here / "out" / "voz-falsa.wav"
if not wav.exists():
    sys.exit("rode antes o 11_cantarolar.py, que gera o áudio de teste")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
        "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-audio-capture={wav}",
    ])
    page = browser.new_context(viewport={"width": 1366, "height": 768}, permissions=["microphone"]).new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://localhost:4173")
    page.wait_for_load_state("networkidle")

    box = page.locator("canvas").bounding_box()
    for i in range(4):
        page.mouse.click(box["x"] + 90 + i * 96, box["y"] + 300 - i * 36)
    page.keyboard.press("Space")
    page.wait_for_timeout(600)
    page.keyboard.press("Enter")

    page.get_by_role("button", name="Partitura").click()
    page.wait_for_selector(".score svg .abcjs-note", timeout=15000)
    print("partitura: ok")

    page.get_by_role("tab", name="Criar").click()
    page.get_by_role("button", name="Gravar um trecho e transcrever").click()
    page.wait_for_timeout(3800)
    page.get_by_role("button", name="Parar e transcrever").click()
    page.wait_for_selector("text=/notas? colocadas? a partir do cursor/", timeout=120000)
    print("transcrição:", page.locator("text=/notas? colocadas? a partir do cursor/").inner_text())
    print("erros no console:", errors or "nenhum")
    browser.close()
    sys.exit(1 if errors else 0)
