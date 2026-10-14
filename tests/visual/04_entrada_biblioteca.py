"""Passos 7, 8 e 9: teclado do computador, biblioteca com autosave e tela de atalhos."""
from common import click_grid, notes, point, shot, studio

Q = 480

with studio() as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")
    live = lambda: sorted(page.evaluate("[...window.__melodias.engine.live]"))

    # ---------- teclado do computador
    page.keyboard.down("a")
    page.keyboard.down("d")
    page.keyboard.down("g")
    page.wait_for_timeout(250)
    assert live() == [60, 64, 67], live()
    shot(page, "04-acorde-no-teclado")
    for k in "adg":
        page.keyboard.up(k)
    assert live() == []
    page.keyboard.press("x")  # sobe uma oitava
    page.keyboard.down("w")
    assert live() == [73], live()
    page.keyboard.up("w")
    page.keyboard.press("z")
    assert state("s.view.getState().kbOctave") == 4

    # teclado lateral: clicar toca, soltar para
    x, y = point(page, 0, 67)
    page.mouse.move(x - 30, y)
    page.mouse.down()
    assert live() == [67], live()
    page.mouse.up()
    assert live() == []

    # digitar no título não toca notas nem dispara atalhos
    title = page.get_by_label("Título da melodia")
    title.click()
    title.type("Valsa da garoa")
    assert live() == [] and state("s.transport.getState().playing") is False
    page.keyboard.press("Enter")

    # ---------- biblioteca
    for i, pitch in enumerate([67, 64, 60]):
        click_grid(page, Q * i, pitch)
    page.get_by_label("Nova tag").fill("valsa")
    page.keyboard.press("Enter")
    page.wait_for_timeout(900)
    assert page.locator("text=Salvo").first.is_visible()
    assert state("s.library.getState().items.length") == 1

    # mudar escala e compasso entra no desfazer
    page.get_by_label("Tonalidade").select_option("D")
    page.get_by_label("Escala ou modo").select_option("dorian")
    page.get_by_label("Fórmula de compasso").select_option("3/4")
    assert page.get_by_title("Tonalidade e escala").inner_text() == "Ré dórico"
    page.wait_for_timeout(300)
    shot(page, "04-re-dorico-3-4")

    # segunda melodia
    page.get_by_role("button", name="Nova melodia").click()
    page.wait_for_timeout(200)
    assert notes(page) == [] and title.input_value() == ""
    title.click()
    title.type("Baião torto")
    page.keyboard.press("Enter")
    for i, pitch in enumerate([60, 60, 67, 65, 64]):
        click_grid(page, 240 * i, pitch)
    page.wait_for_timeout(900)
    assert state("s.library.getState().items.length") == 2

    # busca por tag e por título
    search = page.get_by_label("Buscar na biblioteca")
    search.fill("valsa")
    page.wait_for_timeout(150)
    assert page.locator("aside[aria-label=Biblioteca] li").count() == 1
    search.fill("xyz")
    page.wait_for_timeout(150)
    assert page.locator("text=Nenhuma melodia com").is_visible()
    shot(page, "04-busca-sem-resultado")
    page.get_by_role("button", name="Limpar a busca").click()
    assert page.locator("aside[aria-label=Biblioteca] li").count() == 2

    # abrir a primeira de novo: notas, escala e compasso voltam
    page.locator("aside[aria-label=Biblioteca] li", has_text="Valsa da garoa").click()
    page.wait_for_timeout(300)
    assert title.input_value() == "Valsa da garoa"
    assert [n["pitch"] for n in notes(page)] == [67, 64, 60]
    assert state("s.doc.getState().melody.timeSignature") == [3, 4]
    assert state("s.doc.getState().melody.tags") == ["valsa"]

    # duplicar e renomear
    row = page.locator("aside[aria-label=Biblioteca] li", has_text="Baião torto")
    row.hover()
    row.get_by_title("Duplicar").click()
    page.wait_for_timeout(300)
    assert state("s.library.getState().items.length") == 3
    assert title.input_value() == "Baião torto (cópia)"
    row = page.locator("aside[aria-label=Biblioteca] li", has_text="Baião torto (cópia)")
    row.hover()
    row.get_by_title("Renomear").click()
    page.get_by_label("Novo título").fill("Baião reto")
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    assert title.input_value() == "Baião reto"
    page.mouse.move(700, 500)
    page.wait_for_timeout(200)
    shot(page, "04-biblioteca")

    # apagar pede confirmação
    row = page.locator("aside[aria-label=Biblioteca] li", has_text="Baião reto")
    row.hover()
    row.get_by_title("Apagar").click()
    shot(page, "04-confirmar-apagar")
    row.get_by_role("button", name="Apagar", exact=True).click()
    page.wait_for_timeout(300)
    assert state("s.library.getState().items.length") == 2

    # recarregar a página reabre a última melodia
    current = title.input_value()
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)
    assert page.get_by_label("Título da melodia").input_value() == current, current
    assert len(notes(page)) > 0
    print("reabriu:", current)

    # ---------- atalhos e painéis
    page.keyboard.press("?")
    page.wait_for_timeout(250)
    assert page.locator("dialog[open]").count() == 1
    shot(page, "04-atalhos")
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)
    assert page.locator("dialog[open]").count() == 0

    page.keyboard.press("[")
    page.keyboard.press("]")
    page.wait_for_timeout(350)
    shot(page, "04-paineis-recolhidos")
    print("entrada e biblioteca ok")

with studio(theme="light", fresh=False) as (page, errors):
    page.wait_for_timeout(300)
    shot(page, "04-claro-com-notas")
