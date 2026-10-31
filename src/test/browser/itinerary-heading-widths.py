"""Run with python3 src/test/browser/itinerary-heading-widths.py against the preview."""
import asyncio
import json
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") == "injected":
            key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
            session = os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
        else:
            with open(os.path.expanduser("~/.cache/lovable-auth/session.json")) as f:
                minted = json.load(f)
            key, session = minted["storage_key"], json.dumps(minted["session"])
        await page.goto("http://localhost:8080")
        await page.evaluate("([k,v]) => localStorage.setItem(k,v)", [key,session])
        for width in (390,1280):
            await page.set_viewport_size({"width":width,"height":1800})
            for day in range(1,11):
                await page.goto(f"http://localhost:8080/itinerary?tab=scenes&day={day}")
                await page.wait_for_selector(".day-heading")
                await page.evaluate("document.fonts.ready")
                sizes = await page.evaluate("""() => {
                    const c = document.querySelector('.day-heading-chapter');
                    const d = document.querySelector('.day-heading-date');
                    const t = document.querySelector('.day-title span');
                    const r = document.createRange(); r.selectNodeContents(t);
                    return [c.getBoundingClientRect().width,d.getBoundingClientRect().width,
                      Math.max(...Array.from(r.getClientRects()).map(x=>x.width))];
                }""")
                assert sizes[0] < sizes[1] < sizes[2], f"Day {day}, {width}px: hierarchy broken {sizes}"
        await browser.close()
        print("All ten chapter headings passed at phone and desktop widths.")
asyncio.run(main())
