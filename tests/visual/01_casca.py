"""Passo 1: a casca do estúdio abre, nos dois temas, sem erros no console."""
from common import shot, studio

with studio() as (page, errors):
    shot(page, "01-vazio-escuro")
    print("título:", page.title())
    print("avisos visíveis:", page.locator("[role=status]").all_inner_texts())

with studio(theme="light") as (page, errors):
    shot(page, "01-vazio-claro")
