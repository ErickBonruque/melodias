"""Fase 2: transformações aplicadas pela aba Notas."""
from common import click_grid, notes, shot, studio

Q = 480

with studio() as (page, errors):
    pitches = lambda: [n["pitch"] for n in notes(page)]
    starts = lambda: [n["start"] for n in notes(page)]
    btn = lambda name: page.get_by_role("button", name=name, exact=True)

    assert page.locator("text=Escreva algumas notas e volte aqui").is_visible()
    for i, pitch in enumerate([60, 64, 67, 62]):
        click_grid(page, Q * i, pitch)
    page.keyboard.press("Escape")  # sem seleção: vale para a melodia inteira
    assert page.locator("text=Sem seleção, vale para a melodia inteira.").is_visible()

    btn("Inverter").click()
    assert pitches() == [60, 57, 53, 59], pitches()
    page.keyboard.press("Control+z")
    assert pitches() == [60, 64, 67, 62]

    btn("Retrógrado").click()
    assert starts() == [1440, 960, 480, 0], starts()
    btn("Retrógrado").click()
    assert starts() == [0, 480, 960, 1440]

    btn("Espelhar o contorno").click()
    assert pitches() == [67, 64, 60, 65], pitches()
    page.keyboard.press("Control+z")

    page.get_by_label("grau da escala: subir").click()
    assert pitches() == [62, 65, 69, 64], pitches()
    page.get_by_label("semitom: descer").click()
    assert pitches() == [61, 64, 68, 63]
    page.get_by_label("oitava: subir").click()
    assert pitches() == [73, 76, 80, 75]
    page.keyboard.press("Control+z")  # os três passos de transposição seguidos viram um só desfazer
    assert pitches() == [60, 64, 67, 62], pitches()

    btn("Ritmo × 2").click()
    assert starts() == [0, 960, 1920, 2880] and notes(page)[0]["duration"] == 480
    btn("Ritmo ÷ 2").click()
    assert starts() == [0, 480, 960, 1440]

    # humanizar tira da grade; quantizar a 100% devolve
    page.get_by_role("button", name="Aplicar").first.click()
    assert starts() != [0, 480, 960, 1440], starts()
    assert all(abs(s - g) <= 40 for s, g in zip(starts(), [0, 480, 960, 1440]))
    page.get_by_role("button", name="Aplicar").nth(1).click()
    assert starts() == [0, 480, 960, 1440], starts()

    # com seleção, só as selecionadas mudam
    click_grid(page, Q * 1, 64)
    assert page.locator("text=Vale para as notas selecionadas.").is_visible()
    page.get_by_label("oitava: subir").click()
    assert pitches() == [60, 76, 67, 62], pitches()

    page.get_by_role("tab", name="Som").click()
    assert page.get_by_label("Instrumento").is_visible()
    page.get_by_role("tab", name="Notas").click()
    page.mouse.move(700, 650)
    page.wait_for_timeout(200)
    shot(page, "06-transformar")
    print("transformações ok")
