"""Roda todos os testes visuais em sequência. Use com o with_server.py da skill webapp-testing."""
import subprocess
import sys
from pathlib import Path

here = Path(__file__).parent
failed = []
for script in sorted(here.glob("[0-9]*.py")):
    print(f"\n=== {script.name}")
    if subprocess.run([sys.executable, str(script)], cwd=here).returncode != 0:
        failed.append(script.name)

print("\nfalharam:", ", ".join(failed) if failed else "nenhum")
sys.exit(1 if failed else 0)
