"""Fase 2: acompanhamento com acordes (sugestão, progressões, edição, reprodução)."""
from common import click_grid, point, shot, studio

E = 240

with studio() as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")
    chords = lambda: [c["symbol"] for c in (state("s.doc.getState().melody.chords") or [])]
    page.get_by_role("tab", name="Harmonia").click()
    assert page.locator("text=Escreva uma melodia e volte aqui para ouvi-la com acompanhamento").is_visible()

    # dois compassos: arpejo de Dó, depois arpejo de Sol
    for i, pitch in enumerate([60, 64, 67, 72, 67, 64, 60, 64]):
        click_grid(page, E * i, pitch)
    for i, pitch in enumerate([67, 71, 74, 71, 67, 62, 67, 67]):
        click_grid(page, E * (8 + i), pitch)
    page.keyboard.press("Escape")

    page.get_by_role("button", name="Sugerir acordes para a melodia").click()
    print("sugestão:", chords())
    assert chords() == ["C", "G"], chords()

    # meio compasso por acorde dá quatro acordes
    page.get_by_label("Acorde a cada").select_option("0.5")
    page.get_by_role("button", name="Sugerir acordes para a melodia").click()
    assert len(chords()) == 4 and chords()[0] == "C" and chords()[2] == "G", chords()

    # progressão pronta
    page.get_by_label("Acorde a cada").select_option("1")
    page.get_by_role("button", name="I V vi IV").click()
    assert chords() == ["C", "G"], chords()
    page.get_by_label("Acorde a cada").select_option("0.5")
    page.get_by_role("button", name="I V vi IV").click()
    assert chords() == ["C", "G", "Am", "F"], chords()

    # trocar um acorde na mão
    page.get_by_label("Acorde 4", exact=True).select_option("Dm")
    assert chords() == ["C", "G", "Am", "Dm"]
    page.keyboard.press("Control+z")
    assert chords() == ["C", "G", "Am", "F"]

    # o motor recebe o acompanhamento e toca junto
    assert state("s.engine.backing.length") == 16, state("s.engine.backing.length")
    page.get_by_label("Jeito de tocar os acordes").select_option("arp")
    assert state("s.engine.backing.length") > 16
    page.keyboard.press("Space")
    page.wait_for_function("window.__melodias.engine.position() > 1100", timeout=10000)
    page.mouse.move(700, 620)
    shot(page, "10-acordes-tocando")
    page.keyboard.press("Enter")
    page.keyboard.press("Enter")

    # desligar o acompanhamento esvazia o que vai para o motor, mas as cifras ficam
    page.get_by_label("Tocar o acompanhamento").uncheck()
    assert state("s.engine.backing.length") == 0 and len(chords()) == 4
    page.get_by_label("Tocar o acompanhamento").check()

    # clicar na faixa de cifras não cria nota e leva para a aba Harmonia
    page.get_by_role("tab", name="Notas").click()
    before = state("s.doc.getState().melody.notes.length")
    box = page.locator("canvas").bounding_box()
    x, _ = point(page, E * 5, 60)
    page.mouse.click(x, box["y"] + 30 + 10)
    assert state("s.doc.getState().melody.notes.length") == before
    assert page.get_by_role("tab", name="Harmonia").get_attribute("aria-selected") == "true"

    # os acordes são salvos com a melodia e voltam ao recarregar
    page.wait_for_timeout(900)
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)
    assert chords() == ["C", "G", "Am", "F"], chords()

    page.get_by_role("button", name="Tirar os acordes").click()
    assert chords() == []
    print("acordes ok")
