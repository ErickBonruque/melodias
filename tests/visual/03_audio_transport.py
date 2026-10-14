"""Passos 5 e 6: áudio liga no primeiro gesto, transport toca, cursor anda, loop e metrônomo."""
from common import click_grid, notes, point, shot, studio

Q = 480

with studio() as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")

    assert state("s.transport.getState().audioReady") is False
    assert page.locator("text=O som liga no seu primeiro clique").is_visible()

    # o primeiro clique liga o áudio e o aviso some
    for i, pitch in enumerate([60, 62, 64, 65, 67, 69, 71, 72]):
        click_grid(page, Q * i, pitch)
    page.wait_for_timeout(700)
    assert state("s.transport.getState().audioReady") is True
    assert state("s.engine.isStarted") is True
    print("contexto de áudio:", page.evaluate("new (window.AudioContext)().state"))

    # o piano carrega os samples locais
    page.wait_for_function("window.__melodias.transport.getState().loadingInstrument === null", timeout=15000)
    print("piano carregado")

    # tocar: o cursor anda e as teclas acendem
    page.keyboard.press("Space")
    page.wait_for_timeout(900)
    assert state("s.transport.getState().playing") is True
    pos1 = state("s.engine.position()")
    page.wait_for_timeout(500)
    pos2 = state("s.engine.position()")
    print("posição em ticks:", round(pos1), "->", round(pos2))
    # 96 bpm = 768 ticks por segundo
    assert 250 < pos2 - pos1 < 520, (pos1, pos2)
    shot(page, "03-tocando")

    # pausar guarda a posição; tocar de novo continua dali
    page.keyboard.press("Space")
    paused = state("s.transport.getState().cursor")
    assert state("s.transport.getState().playing") is False and paused > 700, paused
    page.keyboard.press("Space")
    page.wait_for_timeout(300)
    resumed = state("s.engine.position()")
    assert paused < resumed < paused + 400, (paused, resumed)
    # parar volta para onde a reprodução começou; parar de novo vai para o início
    page.keyboard.press("Enter")
    assert state("s.transport.getState().cursor") == paused
    page.keyboard.press("Enter")
    assert state("s.transport.getState().cursor") == 0

    # no fim da melodia a reprodução para sozinha (2 compassos = 5 s a 96 bpm; acelera para 300)
    page.evaluate("window.__melodias.doc.getState().edit({ bpm: 300 })")
    page.keyboard.press("Space")
    page.wait_for_timeout(2400)
    assert state("s.transport.getState().playing") is False, "deveria ter parado no fim"
    print("parou sozinho no fim")

    # loop: arrastar na régua marca a região e a reprodução dá a volta
    x0, y0 = point(page, Q * 2, 100)
    x1, _ = point(page, Q * 4, 100)
    ruler_y = page.locator("canvas").bounding_box()["y"] + 12
    page.mouse.move(x0, ruler_y)
    page.mouse.down()
    page.mouse.move(x1, ruler_y, steps=6)
    page.mouse.up()
    loop = state("s.transport.getState().loop")
    assert loop == {"on": True, "start": 960, "end": 1920}, loop
    page.keyboard.press("Space")
    seen = []
    for _ in range(12):
        page.wait_for_timeout(120)
        seen.append(round(state("s.engine.position()")))
    print("posições no loop:", seen)
    assert all(940 <= p <= 1940 for p in seen), seen
    assert any(b < a for a, b in zip(seen, seen[1:])), "o loop deveria ter dado a volta"
    shot(page, "03-loop")
    page.keyboard.press("Space")

    # clique na régua leva o cursor; tecla C desliga o loop; M liga o metrônomo
    xs, _ = point(page, Q * 6, 100)
    page.mouse.click(xs, ruler_y)
    assert state("s.transport.getState().cursor") == Q * 6
    page.keyboard.press("c")
    assert state("s.transport.getState().loop.on") is False
    page.keyboard.press("m")
    assert state("s.transport.getState().metronome") is True

    # o andamento muda sem mexer nos ticks das notas
    before = notes(page)
    page.evaluate("window.__melodias.doc.getState().edit({ bpm: 60 })")
    assert notes(page) == before
    print("transport ok")
