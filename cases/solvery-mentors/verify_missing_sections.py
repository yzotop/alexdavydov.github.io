#!/usr/bin/env python3
"""Capture missing sections 06 and 07."""

import asyncio
from playwright.async_api import async_playwright

async def verify_missing():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8951/cases/solvery-mentors/index.html"
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Lorenz interpretation
        print("Screenshot: Lorenz interpretation...")
        await page.evaluate("window.scrollTo(0, 5000)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_08_lorenz_interp.png", full_page=False)
        
        # Section 06 mechanisms bullets
        print("Screenshot: Section 06 mechanisms bullets...")
        await page.evaluate("window.scrollTo(0, 7100)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_09_mechanisms_bullets.png", full_page=False)
        
        # Section 07 start
        print("Screenshot: Section 07 start...")
        await page.evaluate("window.scrollTo(0, 7800)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_10_section07_start.png", full_page=False)
        
        # Section 07 more
        print("Screenshot: Section 07 more...")
        await page.evaluate("window.scrollTo(0, 8400)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_11_section07_more.png", full_page=False)
        
        await browser.close()
        print("✓ Missing sections captured!")

if __name__ == "__main__":
    asyncio.run(verify_missing())
