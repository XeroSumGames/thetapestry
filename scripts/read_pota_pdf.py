import fitz
import sys

pdf_path = r"E:\Documents\My RPG's\Planet of the Apes\Planet of the Apes RPG - Core Rulebook (Kickstarter Reward).pdf"
doc = fitz.open(pdf_path)

start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
end = int(sys.argv[2]) if len(sys.argv) > 2 else start + 10

for i in range(start, min(end, len(doc))):
    page = doc[i]
    text = page.get_text()
    # Replace characters that can't be encoded in cp1252
    text = text.encode('utf-8', errors='replace').decode('utf-8')
    sys.stdout.buffer.write(f"\n=== PAGE {i+1} ===\n".encode('utf-8'))
    sys.stdout.buffer.write(text.encode('utf-8'))
    sys.stdout.buffer.write(b"\n")
