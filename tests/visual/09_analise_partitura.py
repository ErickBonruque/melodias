"""Fase 2: análise (tonalidade, fora da escala, rótulos) e partitura sincronizada."""
from common import click_grid, notes, point, shot, studio

Q = 480

with studio() as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")
    page.get_by_role("tab", name="Harmonia").click()
    assert page.locator("text=Com quatro notas ou mais").is_visible()

    # Brilha, brilha, estrelinha em colcheias: cabe inteira na área visível da grade
    E = 240
    for i, pitch in enumerate([60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 60]):
        click_grid(page, E * i, pitch)
    page.keyboard.press("Escape")

    panel = page.locator("[role=tabpanel]")
    assert "Soa como Dó maior, a escala que você escolheu." in panel.inner_text()
    assert "Todas as notas estão na escala." in panel.inner_text()
    assert "Extensão: Dó4 a Lá4." in panel.inner_text()

    # trocando a escala para Mi maior, várias notas ficam de fora e a análise sugere voltar
    page.evaluate("window.__melodias.doc.getState().edit({ key: 'E', scale: 'major' })")
    text = panel.inner_text()
    assert "A escala escolhida é Mi maior." in text and "notas fora da escala" in text, text
    page.get_by_role("button", name="Selecionar").click()
    assert state("s.doc.getState().selection.length") > 3
    page.get_by_title("Usar Dó maior como escala").click()
    assert state("s.doc.getState().melody.key") == "C"

    # uma nota fora da escala: conta, e "trazer para a escala" resolve
    x, y = point(page, E * 12, 66)
    page.keyboard.down("Control")
    page.mouse.click(x + 3, y)
    page.keyboard.up("Control")
    assert "1 nota fora da escala." in panel.inner_text()
    page.get_by_role("button", name="Trazer para a escala").click()
    assert "Todas as notas estão na escala." in panel.inner_text()
    assert notes(page)[-1]["pitch"] == 65

    # a dica da nota inclui o intervalo para a anterior
    x, y = point(page, E * 2 + 20, 67)
    page.mouse.move(x, y)
    page.wait_for_timeout(150)
    tip = page.locator("[role=status]").first.inner_text()
    print("dica:", tip)
    assert tip == "Sol4, 5º grau. 5ª justa acima de Dó4", tip

    # rótulos: grau e intervalo
    page.get_by_role("radio", name="Intervalo").click()
    assert state("s.view.getState().noteLabel") == "interval"

    # partitura
    page.get_by_role("button", name="Partitura").click()
    page.wait_for_selector(".score svg .abcjs-note", timeout=15000)
    page.wait_for_timeout(300)
    drawn = page.locator(".score svg .abcjs-note").count()
    print("figuras na pauta:", drawn)
    assert drawn == 13, drawn  # 13 colcheias; o resto do segundo compasso é pausa
    assert page.locator(".score svg .abcjs-rest").count() >= 1

    # clicar numa nota da pauta leva o cursor
    # (o abcjs trata o clique no svg inteiro e acha a figura pela posição)
    target = page.locator(".score svg .abcjs-note").nth(4).bounding_box()
    page.mouse.click(target["x"] + target["width"] / 2, target["y"] + target["height"] - 4)
    assert state("s.transport.getState().cursor") == E * 4

    # tocando, a nota da vez acende na pauta
    page.evaluate("window.__melodias.transport.getState().set({ cursor: 0 })")
    page.keyboard.press("Space")
    page.wait_for_function("document.querySelectorAll('.score .score-on').length > 0", timeout=8000)
    page.wait_for_timeout(700)
    shot(page, "09-partitura-tocando")
    page.keyboard.press("Enter")
    page.wait_for_timeout(200)
    assert page.locator(".score .score-on").count() == 0

    # a pauta acompanha as edições
    page.keyboard.press("Control+a")
    page.keyboard.press("Delete")
    page.wait_for_timeout(400)
    assert page.locator("text=A partitura aparece aqui").is_visible()
    print("análise e partitura ok")
