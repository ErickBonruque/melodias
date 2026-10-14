"""Fase 2: gravar tocando, com contagem de entrada e quantização."""
from common import notes, shot, studio

with studio() as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")
    page.evaluate("window.__melodias.doc.getState().edit({ bpm: 120 })")  # 1 tempo = 0,5 s; 1 compasso = 2 s
    page.get_by_role("tab", name="Criar").click()

    # R começa: contagem de 1 compasso, depois grava
    page.keyboard.press("r")
    page.wait_for_timeout(700)
    assert state("s.transport.getState().recording") is True
    left = state("s.engine.countInBeatsLeft()")
    count = page.get_by_label("Contagem de entrada").inner_text()
    print("contagem: faltam", round(left, 2), "tempos, na tela:", count)
    assert 1.5 < left < 3.5 and count in ("2", "3"), (left, count)
    shot(page, "07-contagem")

    # nota tocada cedo demais na contagem é ignorada
    page.keyboard.press("a")
    page.wait_for_function("window.__melodias.engine.countInBeatsLeft() === 0", timeout=5000)
    assert notes(page) == []

    # toca Dó, Mi, Sol, mais ou menos um por tempo, um pouco fora da grade
    page.wait_for_timeout(60)
    for key in "adg":
        page.keyboard.down(key)
        page.wait_for_timeout(230)
        page.keyboard.up(key)
        page.wait_for_timeout(270)
    live_view = notes(page)
    assert [n["pitch"] for n in live_view] == [60, 64, 67], live_view
    page.keyboard.down("k")  # segura o Dó5 e encerra com ele ainda soando
    page.wait_for_timeout(400)
    shot(page, "07-gravando")
    page.keyboard.press("r")
    page.keyboard.up("k")
    page.wait_for_timeout(200)

    out = notes(page)
    print("gravado:", out)
    assert state("s.transport.getState().recording") is False and state("s.transport.getState().playing") is False
    assert [n["pitch"] for n in out] == [60, 64, 67, 72]
    # quantizado a 100% em 1/16: todo início é múltiplo de 120, perto de 0, 480, 960, 1440
    assert all(n["start"] % 120 == 0 for n in out), out
    for n, expected in zip(out, [0, 480, 960, 1440]):
        assert abs(n["start"] - expected) <= 120, (n, expected)
    assert all(150 <= n["duration"] <= 420 for n in out[:3]), out
    assert out[3]["duration"] >= 250, out[3]  # a nota segurada foi fechada na hora de parar
    assert state("s.doc.getState().selection.length") == 4

    # a tomada é um passo só de desfazer
    page.keyboard.press("Control+z")
    assert notes(page) == []
    page.keyboard.press("Control+Shift+z")
    assert len(notes(page)) == 4

    # sem contagem e sem quantizar: grava do jeito que saiu
    page.get_by_label("Contagem antes").select_option("0")
    page.get_by_label("Quantizar ao terminar").uncheck()
    page.evaluate("window.__melodias.transport.getState().set({ cursor: 1920 })")
    page.get_by_role("button", name="Gravar a partir do cursor").click()
    page.wait_for_timeout(450)
    page.keyboard.down("s")
    page.wait_for_timeout(200)
    page.keyboard.up("s")
    page.get_by_role("button", name="Encerrar a gravação").first.click()
    last = notes(page)[-1]
    print("sem quantizar:", last)
    assert last["pitch"] == 62 and 1920 + 200 < last["start"] < 1920 + 700
    print("gravação ok")
