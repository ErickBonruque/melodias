"""Passos 3 e 4: criar, mover, redimensionar, selecionar, copiar/colar, apagar, desfazer."""
from common import click_grid, notes, point, shot, studio

Q = 480  # semínima em ticks

with studio() as (page, errors):
    # hover do lápis mostra a prévia da nota
    x, y = point(page, Q * 2, 64)
    page.mouse.move(x + 5, y)
    page.wait_for_timeout(120)
    shot(page, "02-previa-do-lapis")

    # cria uma frase: Dó Mi Sol Mi, uma nota por tempo
    for i, pitch in enumerate([60, 64, 67, 64]):
        click_grid(page, Q * i, pitch)
    print("criadas:", notes(page))
    assert [n["pitch"] for n in notes(page)] == [60, 64, 67, 64]
    assert [n["start"] for n in notes(page)] == [0, 480, 960, 1440]

    # com snap na escala, clicar numa linha fora da escala (Dó♯) cai em Dó
    click_grid(page, Q * 4, 61)
    assert notes(page)[-1]["pitch"] == 60, notes(page)[-1]

    # clicar e arrastar ao criar estica a nota até uma semínima e meia
    x, y = point(page, Q * 5, 72)
    page.mouse.move(x + 2, y)
    page.mouse.down()
    page.mouse.move(x + 144, y, steps=6)  # 1,5 tempo a 96 px por tempo
    page.mouse.up()
    assert notes(page)[-1] == {"pitch": 72, "start": 2400, "duration": 720}, notes(page)[-1]

    # hover numa nota mostra nome e grau
    x, y = point(page, Q * 2 + 60, 67)
    page.mouse.move(x, y)
    page.wait_for_timeout(150)
    tip = page.locator("[role=status]").first.inner_text()
    print("dica:", tip)
    assert tip == "Sol4, 5º grau", tip
    shot(page, "02-notas-e-dica")

    # arrastar a nota Sol um tempo para a direita e dois graus para cima (Sol → Si)
    page.mouse.down()
    x2, y2 = point(page, Q * 3 + 60, 71)
    page.mouse.move(x2, y2, steps=8)
    page.mouse.up()
    moved = notes(page)[2]
    assert moved == {"pitch": 71, "start": 1440, "duration": 240}, moved

    # desfazer devolve, refazer repete
    page.keyboard.press("Control+z")
    assert notes(page)[2]["pitch"] == 67
    page.keyboard.press("Control+Shift+z")
    assert notes(page)[2]["pitch"] == 71
    page.keyboard.press("Control+z")

    # redimensionar pela borda direita: a primeira nota (colcheia) vira semínima
    x, y = point(page, 240, 60)
    page.mouse.move(x - 3, y)
    page.mouse.down()
    page.mouse.move(x + 45, y, steps=5)
    page.mouse.up()
    assert notes(page)[0]["duration"] == 480, notes(page)[0]

    # retângulo de seleção com Shift pega as três primeiras notas
    x0, y0 = point(page, 10, 69)
    x1, y1 = point(page, Q * 2 + 200, 58)
    page.keyboard.down("Shift")
    page.mouse.move(x0, y0)
    page.mouse.down()
    page.mouse.move(x1, y1, steps=8)
    shot(page, "02-retangulo-de-selecao")
    page.mouse.up()
    page.keyboard.up("Shift")
    sel = page.evaluate("window.__melodias.doc.getState().selection.length")
    assert sel == 3, sel

    # copiar e colar: o cursor está no início, então cola por cima e avança o cursor
    page.keyboard.press("Control+c")
    page.evaluate("window.__melodias.transport.getState().set({ cursor: 480 * 8 })")
    page.keyboard.press("Control+v")
    assert len(notes(page)) == 9
    page.wait_for_timeout(500)  # a visão rola até o cursor; espera assentar antes de mirar na grade
    pasted_x, _ = point(page, 3840, 60)
    box = page.locator("canvas").bounding_box()
    assert box["x"] + 72 <= pasted_x <= box["x"] + box["width"], "as notas coladas precisam continuar à vista"
    assert [n["start"] for n in notes(page)[-3:]] == [3840, 4320, 4800]

    # setas: sobe um grau (Dó Mi Sol → Ré Fá Lá), Shift+seta sobe uma oitava
    page.keyboard.press("ArrowUp")
    assert [n["pitch"] for n in notes(page)[-3:]] == [62, 65, 69]
    page.keyboard.press("Shift+ArrowUp")
    assert [n["pitch"] for n in notes(page)[-3:]] == [74, 77, 81]
    page.keyboard.press("ArrowRight")
    assert notes(page)[-3]["start"] == 3840 + 120

    # Ctrl+D repete a seleção logo depois
    page.keyboard.press("Control+d")
    assert len(notes(page)) == 12

    # apagar: Delete tira a seleção, botão direito tira uma nota
    page.keyboard.press("Delete")
    assert len(notes(page)) == 9
    x, y = point(page, Q * 4 + 20, 60)
    page.mouse.click(x, y, button="right")
    assert len(notes(page)) == 8

    # ferramenta de seleção (tecla 2): arrastar no vazio não cria nota
    page.keyboard.press("2")
    x0, y0 = point(page, Q * 6, 80)
    page.mouse.move(x0, y0)
    page.mouse.down()
    page.mouse.move(x0 + 60, y0 + 40, steps=4)
    page.mouse.up()
    assert len(notes(page)) == 8
    page.keyboard.press("1")

    page.keyboard.press("Control+a")
    page.mouse.move(700, 600)
    page.wait_for_timeout(200)
    shot(page, "02-tudo-selecionado")

    # desfazer até o fim esvazia a melodia
    for _ in range(40):
        page.keyboard.press("Control+z")
    assert notes(page) == [], notes(page)
    print("edição ok")
