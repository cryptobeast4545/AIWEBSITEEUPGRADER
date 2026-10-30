#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_pdf.py
Converts AccessLayer_Documentation.html -> AccessLayer_Documentation.pdf
Uses weasyprint (preferred) or falls back to pdfkit / playwright.
Run:  python docs/generate_pdf.py
"""

import sys
from pathlib import Path

HTML = Path(__file__).parent / "AccessLayer_Documentation.html"
PDF  = Path(__file__).parent / "AccessLayer_Documentation.pdf"

def try_weasyprint():
    from weasyprint import HTML as WH
    print("Using weasyprint...")
    WH(filename=str(HTML)).write_pdf(str(PDF))
    print(f"[OK] PDF written to {PDF}")

def try_pdfkit():
    import pdfkit
    print("Using pdfkit (wkhtmltopdf)...")
    options = {
        "page-size": "A4",
        "margin-top": "0",
        "margin-bottom": "0",
        "margin-left": "0",
        "margin-right": "0",
        "encoding": "UTF-8",
        "enable-local-file-access": "",
    }
    pdfkit.from_file(str(HTML), str(PDF), options=options)
    print(f"[OK] PDF written to {PDF}")

def try_playwright():
    from playwright.sync_api import sync_playwright
    print("Using Playwright (Chromium headless)...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 900})
        page.goto(HTML.as_uri())
        page.wait_for_timeout(2000)
        page.pdf(
            path=str(PDF),
            format="A4",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        browser.close()
    print(f"[OK] PDF written to {PDF}")

for fn in (try_weasyprint, try_pdfkit, try_playwright):
    try:
        fn()
        sys.exit(0)
    except ImportError as e:
        print(f"  [skip] {fn.__name__} not available ({e}), trying next...")
    except Exception as e:
        print(f"  [fail] {fn.__name__} failed: {e}")

print("[ERROR] No PDF renderer available.")
print("Install one of:")
print("  pip install weasyprint")
print("  pip install pdfkit        (also needs: choco install wkhtmltopdf)")
print("  pip install playwright && python -m playwright install chromium")
print(f"The HTML version is ready at: {HTML}")
sys.exit(1)
