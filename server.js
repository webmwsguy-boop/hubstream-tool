const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.static('public'));

app.get('/api/get-link', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL provide karein' });

    let browser;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Ad layer block karna
        await page.evaluate(() => {
            window.cache_loader = { init: function() {} };
            document.querySelectorAll('div[style*="position:fixed;inset:0px"]').forEach(el => el.remove());
        });

        // Get Video button ka wait karna (max 30 sec)
        await page.waitForSelector('button.downloader-button', { visible: true, timeout: 30000 });

        // Invisible layer dobara hata dena
        await page.evaluate(() => {
            document.querySelectorAll('div[style*="position:fixed;inset:0px"]').forEach(el => el.remove());
        });

        // Button par JavaScript ke through click karna (ad layer se bachne ke liye)
        await page.evaluate(() => {
            const btn = document.querySelector('button.downloader-button');
            if (btn) btn.click();
        });

        console.log('Bot: Get Video par click ho gaya, Download link ka wait ho raha hai...');

        // Ab wait karenge ki button change ho kar <a> tag mein convert ho jaye
        await page.waitForFunction(() => {
            const linkElement = document.querySelector('a.downloader-button');
            // Check karenge ki wo element exist karta hai aur usme http wala link hai ya nahi
            return linkElement && linkElement.href && linkElement.href.startsWith('http');
        }, { timeout: 20000 });

        // Sahi link ko extract karna
        const finalLink = await page.evaluate(() => {
            const linkElement = document.querySelector('a.downloader-button');
            return linkElement ? linkElement.href : null;
        });

        if (finalLink) {
            console.log('Bot: Sahi link mil gaya! -> ' + finalLink);
            res.json({ success: true, data: finalLink });
        } else {
            res.status(500).json({ success: false, error: 'Link extract nahi ho paya' });
        }

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chal raha hai port ${PORT} par`));
