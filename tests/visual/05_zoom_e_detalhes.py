"""Zoom, rolagem, nota fora da escala, cópia com Alt, alças do loop e tema claro com notas."""
from common import click_grid, notes, point, shot, studio

Q = 480

with studio(width=1280, height=720) as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")
    box = page.locator("canvas").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

    for i, pitch in enumerate([60, 64, 67, 72, 71, 67, 64, 62]):
        click_grid(page, 240 * i, pitch)

    # Ctrl+clique escapa do snap: nota fora da escala (Fá♯) sai cinza e hachurada
    x, y = point(page, Q * 5, 66)
    page.keyboard.down("Control")
    page.mouse.click(x + 3, y)
    page.keyboard.up("Control")
    assert notes(page)[-1] == {"pitch": 66, "start": Q * 5, "duration": 240}, notes(page)[-1]

    # Alt+arrastar leva uma cópia
    x, y = point(page, 110, 60)
    x2, y2 = point(page, Q * 6 + 110, 60)
    page.keyboard.down("Alt")
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x2, y2, steps=8)
    page.mouse.up()
    page.keyboard.up("Alt")
    assert len(notes(page)) == 10 and notes(page)[-1]["start"] == Q * 6, notes(page)[-1]
    assert notes(page)[0]["start"] == 0

    # zoom horizontal com Ctrl+roda mantém parado o tick sob o mouse
    px0 = state("s.view.getState().pxPerBeat")
    tick_x, _ = point(page, Q * 2, 64)
    page.mouse.move(tick_x, cy)
    page.keyboard.down("Control")
    page.mouse.wheel(0, -300)
    page.keyboard.up("Control")
    page.wait_for_timeout(200)
    px1 = state("s.view.getState().pxPerBeat")
    after_x, _ = point(page, Q * 2, 64)
    print("zoom horizontal:", round(px0), "->", round(px1), "| âncora andou", round(abs(after_x - tick_x), 1), "px")
    assert px1 > px0 * 1.5 and abs(after_x - tick_x) < 1.5

    # zoom vertical com Alt+roda e pelos botões
    row0 = state("s.view.getState().rowH")
    page.keyboard.down("Alt")
    page.mouse.wheel(0, -100)
    page.keyboard.up("Alt")
    page.wait_for_timeout(150)
    assert state("s.view.getState().rowH") > row0
    page.get_by_label("Menos zoom vertical").click()
    page.get_by_label("Menos zoom horizontal").click()
    page.get_by_label("Menos zoom horizontal").click()
    page.wait_for_timeout(200)

    # rolagem suave: a roda move a grade aos poucos, e não passa dos limites
    _, y_before = point(page, 0, 60)
    page.mouse.move(cx, cy)
    page.mouse.wheel(0, 240)
    page.wait_for_timeout(40)
    _, y_mid = point(page, 0, 60)
    page.wait_for_timeout(500)
    _, y_after = point(page, 0, 60)
    print("rolagem vertical:", round(y_before - y_mid), "px no meio do caminho,", round(y_before - y_after), "px no fim")
    assert 0 < y_before - y_mid < 240 and abs((y_before - y_after) - 240) < 2
    page.mouse.wheel(0, -100000)
    page.wait_for_timeout(700)
    top_y = page.evaluate("window.__roll.pointFor(0, 108).y")
    assert top_y > box["y"] + 30, "não deveria rolar além do topo do teclado"
    page.mouse.wheel(0, 100000)
    page.wait_for_timeout(100)
    page.mouse.wheel(0, -1210)
    page.wait_for_timeout(700)

    # botão do meio arrasta a grade
    x_before, _ = point(page, Q * 4, 60)
    page.mouse.move(cx, cy)
    page.mouse.down(button="middle")
    page.mouse.move(cx - 120, cy, steps=4)
    page.mouse.up(button="middle")
    x_after, _ = point(page, Q * 4, 60)
    assert abs((x_before - x_after) - 120) < 2, (x_before, x_after)
    page.mouse.down(button="middle")
    page.mouse.move(cx + 400, cy, steps=4)
    page.mouse.up(button="middle")

    # loop: tecla C abraça a melodia; a alça do fim encolhe a região
    page.keyboard.press("c")
    loop = state("s.transport.getState().loop")
    assert loop == {"on": True, "start": 0, "end": 3840}, loop
    page.get_by_label("Menos zoom horizontal").click()
    page.get_by_label("Menos zoom horizontal").click()
    page.wait_for_timeout(200)
    ex, _ = point(page, 3840, 60)
    nx, _ = point(page, 1920, 60)
    assert ex < box["x"] + box["width"], "a alça do fim precisa estar visível"

    ruler_y = box["y"] + 14
    page.mouse.move(ex, ruler_y)
    page.mouse.down()
    page.mouse.move(nx, ruler_y, steps=6)
    page.mouse.up()
    assert state("s.transport.getState().loop.end") == 1920

    # centraliza na melodia e fotografa nos dois temas
    y60 = page.evaluate("window.__roll.pointFor(0, 66).y")
    page.mouse.move(cx, cy)
    page.mouse.wheel(0, y60 - cy)
    page.wait_for_timeout(600)
    page.keyboard.press("Control+a")
    page.keyboard.press("Escape")
    page.mouse.move(cx + 150, cy + 190)
    page.wait_for_timeout(200)
    shot(page, "05-escuro-1280")
    page.get_by_label("Alternar tema claro e escuro").click()
    page.wait_for_timeout(300)
    shot(page, "05-claro-1280")
    print("zoom e detalhes ok")
