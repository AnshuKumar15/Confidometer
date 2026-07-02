import os
from pypdf import PdfReader

def extract_text_from_resume(file_path: str) -> str:
    _, ext = os.path.splitext(file_path.lower())
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif ext == ".pdf":
        text = ""
        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        except Exception as e:
            print(f"[ERROR] PDF extraction failed: {e}")
        return text.strip()
    else:
        raise ValueError(f"Unsupported file format: {ext}")
