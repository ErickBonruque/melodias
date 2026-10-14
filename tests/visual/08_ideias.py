"""Fase 2: gerador de ideias e variações de motivo."""
from common import notes, shot, studio

with studio() as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")
    sel = lambda: state("s.doc.getState().selection.length")
    in_scale = lambda ns, chromas: all(n["pitch"] % 12 in chromas for n in ns)
    page.get_by_role("tab", name="Criar").click()

    # melodia vazia: gera a partir do zero, seleciona e toca
    page.get_by_role("radio", name="Sobe").click()
    page.get_by_label("Tamanho").select_option("2")
    page.get_by_role("button", name="Gerar melodia").click()
    page.wait_for_timeout(300)
    first = notes(page)
    print("ideia:", [n["pitch"] for n in first])
    assert len(first) >= 3 and first[0]["start"] == 0 and sel() == len(first)
    assert in_scale(first, {0, 2, 4, 5, 7, 9, 11})
    assert max(n["start"] + n["duration"] for n in first) <= 2 * 1920
    assert first[-1]["pitch"] % 12 == 0, "deveria repousar na tônica"
    assert first[-1]["pitch"] > first[0]["pitch"], "o contorno pedido era subir"
    assert state("s.transport.getState().playing") is True, "deveria tocar ao gerar"

    # gerar de novo troca a ideia em vez de empilhar
    page.get_by_role("button", name="Gerar melodia").click()
    page.wait_for_timeout(200)
    second = notes(page)
    assert max(n["start"] + n["duration"] for n in second) <= 2 * 1920
    assert second != first and sel() == len(second)
    page.keyboard.press("Control+z")
    assert notes(page) == first
    page.keyboard.press("Control+Shift+z")
    page.keyboard.press("Enter")
    page.keyboard.press("Enter")

    # com outra escala e repouso na quinta
    page.get_by_role("tab", name="Notas").click()
    page.get_by_label("Tonalidade").select_option("A")
    page.get_by_label("Escala ou modo").select_option("minor pentatonic")
    page.get_by_role("tab", name="Criar").click()
    page.get_by_label("Repousa na").select_option("5")
    page.get_by_role("radio", name="Arco").click()
    page.get_by_label("Tocar assim que gerar").uncheck()
    page.keyboard.press("Control+a")
    page.keyboard.press("Delete")
    page.get_by_role("button", name="Gerar melodia").click()
    penta = notes(page)
    assert in_scale(penta, {9, 0, 2, 4, 7}) and penta[-1]["pitch"] % 12 == 4, penta[-1]
    assert state("s.transport.getState().playing") is False

    # variação: precisa de três notas selecionadas
    page.keyboard.press("Escape")
    assert page.locator("text=Selecione pelo menos três notas").is_visible()
    page.keyboard.press("Control+a")
    n = len(penta)
    page.get_by_role("button", name=f"Criar variação das {n} notas").click()
    both = notes(page)
    variation = both[n:]
    assert len(both) == 2 * n and sel() == n
    assert [v["start"] - 2 * 1920 for v in variation] == [p["start"] for p in penta], "a variação mantém o ritmo, um trecho depois"
    assert [v["duration"] for v in variation] == [p["duration"] for p in penta]
    assert in_scale(variation, {9, 0, 2, 4, 7})
    assert [v["pitch"] for v in variation] != [p["pitch"] for p in penta]
    # pedir de novo troca a variação, a partir do mesmo motivo
    page.get_by_role("button", name=f"Criar variação das {n} notas").click()
    assert len(notes(page)) == 2 * n
    page.wait_for_timeout(500)
    box = page.locator("canvas").bounding_box()
    vx = page.evaluate("t => window.__roll.pointFor(t, 60).x", 2 * 1920)
    assert box["x"] + 72 <= vx <= box["x"] + box["width"] - 100, "a variação precisa aparecer na tela"
    page.mouse.move(700, 620)
    page.wait_for_timeout(300)
    shot(page, "08-ideia-e-variacao")
    print("ideias ok")
