#!/usr/bin/env python3
"""Capture complete section 06 and section 07."""

import asyncio
from playwright.async_api import async_playwright

async def verify_section07():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8951/cases/solvery-mentors/index.html"
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Complete section 06
        print("Screenshot: Complete section 06...")
        await page.evaluate("window.scrollTo(0, 7400)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_12_section06_complete.png", full_page=False)
        
        # Section 07 start
        print("Screenshot: Section 07 complete...")
        await page.evaluate("window.scrollTo(0, 7900)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_13_section07_complete.png", full_page=False)
        
        # Section 07 more
        print("Screenshot: Section 07 more bullets...")
        await page.evaluate("window.scrollTo(0, 8500)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_14_section07_bullets.png", full_page=False)
        
        await browser.close()
        print("✓ Section 07 captured!")

if __name__ == "__main__":
    asyncio.run(verify_section07())
