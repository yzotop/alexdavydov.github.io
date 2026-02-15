#!/usr/bin/env python3
"""Verify all text-only changes on the page."""

import asyncio
from playwright.async_api import async_playwright

async def verify_text_changes():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8951/cases/solvery-mentors/index.html"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Screenshot 1: Top - executive framing + KPIs
        print("Screenshot 1: Executive framing and KPIs...")
        await page.screenshot(path="text_01_top.png", full_page=False)
        
        # Screenshot 2: Section 01 - marketplace framing bullets
        print("Screenshot 2: Marketplace framing in section 01...")
        await page.evaluate("window.scrollTo(0, 800)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_02_context.png", full_page=False)
        
        # Screenshot 3: Section 03 - demand/supply interpretation
        print("Screenshot 3: Demand vs Supply interpretation...")
        await page.evaluate("window.scrollTo(0, 3400)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_03_demand_supply.png", full_page=False)
        
        # Screenshot 4: Section 05 - Lorenz + Core/LongTail interpretations
        print("Screenshot 4: Lorenz and Core/LongTail interpretations...")
        await page.evaluate("window.scrollTo(0, 5300)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_04_pareto.png", full_page=False)
        
        # Screenshot 5: Section 06 - Marketplace mechanisms (rewritten)
        print("Screenshot 5: Marketplace mechanisms section...")
        await page.evaluate("window.scrollTo(0, 6900)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_05_mechanisms.png", full_page=False)
        
        # Screenshot 6: Section 07 - Product conclusions (rewritten)
        print("Screenshot 6: Product conclusions section...")
        await page.evaluate("window.scrollTo(0, 7600)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_06_conclusions.png", full_page=False)
        
        # Screenshot 7: More of section 07
        print("Screenshot 7: More product conclusions...")
        await page.evaluate("window.scrollTo(0, 8200)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="text_07_conclusions_more.png", full_page=False)
        
        await browser.close()
        print("✓ All text verification screenshots saved!")

if __name__ == "__main__":
    asyncio.run(verify_text_changes())
