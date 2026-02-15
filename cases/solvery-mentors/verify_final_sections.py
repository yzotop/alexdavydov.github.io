#!/usr/bin/env python3
"""Capture final bullets and section 07."""

import asyncio
from playwright.async_api import async_playwright

async def verify_final():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8951/cases/solvery-mentors/index.html"
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Rest of section 06 + section 07 start
        print("Screenshot: Rest of section 06 and section 07...")
        await page.evaluate("window.scrollTo(0, 7650)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_15_sections_06_07.png", full_page=False)
        
        # Section 07 sub-blocks
        print("Screenshot: Section 07 sub-blocks...")
        await page.evaluate("window.scrollTo(0, 8100)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_16_section07_blocks.png", full_page=False)
        
        # More section 07
        print("Screenshot: More section 07...")
        await page.evaluate("window.scrollTo(0, 8650)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_17_section07_final.png", full_page=False)
        
        await browser.close()
        print("✓ Final sections captured!")

if __name__ == "__main__":
    asyncio.run(verify_final())
