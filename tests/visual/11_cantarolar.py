"""Fase 2: cantarolar. Um WAV sintetizado (Dó4, Mi4, Sol4 em laço) faz o papel do microfone."""
import math
import struct
import wave

from common import OUT, notes, shot, studio

RATE = 48000
WAV = OUT / "voz-falsa.wav"


def synth():
    """Dó, Mi, Sol com harmônicos, como uma voz firme, e silêncio entre as notas."""
    samples = [0.0] * int(RATE * 0.25)
    for midi in (60, 64, 67):
        freq = 440 * 2 ** ((midi - 69) / 12)
        n = int(RATE * 0.6)
        for i in range(n):
            t = i / RATE
            fade = min(1.0, i / (RATE * 0.02), (n - i) / (RATE * 0.02))
            wave_sum = math.sin(2 * math.pi * freq * t) + 0.5 * math.sin(4 * math.pi * freq * t) + 0.25 * math.sin(6 * math.pi * freq * t)
            samples.append(0.35 * fade * wave_sum / 1.75)
        samples += [0.0] * int(RATE * 0.15)
    samples += [0.0] * int(RATE * 0.9)
    with wave.open(str(WAV), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))
    return len(samples) / RATE


period = synth()
print(f"voz falsa: {period:.2f} s por volta")

with studio(fake_mic=str(WAV)) as (page, errors):
    state = lambda expr: page.evaluate(f"(() => {{ const s = window.__melodias; return {expr} }})()")
    page.get_by_role("tab", name="Criar").click()

    # ---------- ao vivo: mostra a nota cantada e acende a tecla
    page.get_by_role("button", name="Ligar o microfone e ver a nota").click()
    page.wait_for_function("window.__melodias.hum.getState().listening", timeout=10000)
    heard, lit = set(), set()
    shot_done = False
    for _ in range(70):
        page.wait_for_timeout(60)
        pitch, live = page.evaluate("[window.__melodias.hum.getState().pitch, [...window.__melodias.engine.live]]")
        lit.update(live)
        if pitch is not None:
            heard.add(pitch)
            if not shot_done and pitch == 64:
                shot(page, "11-cantando")
                shot_done = True
    print("notas ouvidas ao vivo:", sorted(heard))
    assert heard == {60, 64, 67}, heard
    assert lit == {60, 64, 67}, f"as notas cantadas deveriam acender as teclas: {lit}"
    assert page.get_by_label("Nota cantada").is_visible()

    # ---------- gravar cantando: as notas da voz entram na grade
    page.get_by_label("Contagem antes").select_option("0")
    page.get_by_label("Quantizar ao terminar").uncheck()
    page.keyboard.press("r")
    page.wait_for_timeout(int(period * 1000) + 700)
    page.keyboard.press("r")
    page.wait_for_timeout(200)
    sung = notes(page)
    print("gravado da voz:", [(n["pitch"], n["duration"]) for n in sung])
    assert len(sung) >= 3 and {n["pitch"] for n in sung} == {60, 64, 67}, sung
    # cada nota do arquivo dura 0,6 s = 460 ticks a 96 bpm
    # (a primeira e a última podem ter sido pegas pela metade, conforme o ponto do laço em que a gravação começou)
    whole = [n for n in sung if 400 <= n["duration"] <= 560]
    assert len(whole) >= 2, sung

    page.get_by_role("button", name="Desligar o microfone").click()
    assert state("s.hum.getState().listening") is False and state("[...s.engine.live]") == []
    page.keyboard.press("Control+a")
    page.keyboard.press("Delete")

    # ---------- gravar um trecho e transcrever com o Basic Pitch
    page.get_by_role("button", name="Gravar um trecho e transcrever").click()
    page.wait_for_function("window.__melodias.hum.getState().capture === 'recording'", timeout=10000)
    page.wait_for_timeout(int(period * 1000) + 400)
    page.get_by_role("button", name="Parar e transcrever").click()
    page.wait_for_function("window.__melodias.hum.getState().capture === 'idle'", timeout=120000)
    message = state("s.hum.getState().message")
    problem = state("s.hum.getState().error")
    out = notes(page)
    print("mensagem:", message, "| erro:", problem)
    print("transcrito:", [(n["pitch"], n["start"], n["duration"]) for n in out])
    assert problem is None and len(out) >= 3, (problem, out)
    assert {60, 64, 67} <= {n["pitch"] for n in out}, out
    assert state("s.doc.getState().selection.length") == len(out)
    page.mouse.move(700, 640)
    page.wait_for_timeout(300)
    shot(page, "11-transcrito")
    print("cantarolar ok")
