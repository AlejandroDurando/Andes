// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

const PAGES = [
  { name: 'Home', path: '/index.html' },
  { name: 'Galpones', path: '/galpones.html' },
  { name: 'Tinglados', path: '/tinglados.html' },
  { name: 'Obras', path: '/obras.html' },
  { name: 'FAQ', path: '/faq.html' },
  { name: 'Contacto', path: '/contacto.html' },
  { name: 'Celdas', path: '/celdas.html' },
];

// Block external resources that slow down tests (videos, CDNs)
async function blockExternalRequests(page) {
  await page.route('**/*.mp4', route => route.abort());
  await page.route('**/fonts.googleapis.com/**', route => route.abort());
  await page.route('**/fonts.gstatic.com/**', route => route.abort());
  await page.route('**/cdn.jsdelivr.net/**', route => route.abort());
}

test.describe('ANDES WEBSITE AUDIT', () => {

  test.describe('1. Carga de Páginas', () => {
    for (const pg of PAGES) {
      test(`${pg.name} - responde correctamente`, async ({ page }) => {
        await blockExternalRequests(page);
        const start = Date.now();
        const response = await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const loadTime = Date.now() - start;

        console.log(`  ${pg.name}: HTTP ${response.status()}, carga: ${loadTime}ms`);
        expect(response.status()).toBeLessThan(400);
      });
    }
  });

  test.describe('2. SEO y Meta Tags', () => {
    for (const pg of PAGES) {
      test(`${pg.name} - meta tags`, async ({ page }) => {
        await blockExternalRequests(page);
        await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const seo = await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
          viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || null,
          ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || null,
          ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || null,
          ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
          ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') || null,
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
          twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || null,
          jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
          favicon: document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length,
        }));

        const { title, description, viewport, ogTitle, ogDescription, ogImage, ogUrl, canonical, twitterCard, jsonLd, favicon } = seo;

        const titleLen = title?.length || 0;
        const descLen = description?.length || 0;

        console.log(`\n  === ${pg.name} ===`);
        console.log(`  Title: "${title}" (${titleLen} chars) ${titleLen >= 30 && titleLen <= 60 ? '✓ óptimo' : titleLen > 60 ? '⚠ demasiado largo (>60)' : '⚠ demasiado corto (<30)'}`);
        console.log(`  Description: ${description ? `"${description.slice(0,60)}..." (${descLen} chars) ${descLen >= 120 && descLen <= 160 ? '✓ óptimo' : descLen > 160 ? '⚠ demasiado larga (>160)' : '⚠ demasiado corta (<120)'}` : '✗ FALTA'}`);
        console.log(`  Viewport: ${viewport ? '✓' : '✗ FALTA'}`);
        console.log(`  OG Title: ${ogTitle ? '✓' : '✗ FALTA'}`);
        console.log(`  OG Description: ${ogDescription ? '✓' : '✗ FALTA'}`);
        console.log(`  OG Image: ${ogImage ? '✓' : '✗ FALTA'}`);
        console.log(`  OG URL: ${ogUrl ? '✓' : '✗ FALTA'}`);
        console.log(`  Canonical: ${canonical ? `✓ ${canonical}` : '✗ FALTA'}`);
        console.log(`  Twitter Card: ${twitterCard ? `✓ ${twitterCard}` : '✗ FALTA'}`);
        console.log(`  JSON-LD: ${jsonLd > 0 ? `✓ (${jsonLd} bloques)` : '✗ FALTA'}`);
        console.log(`  Favicon: ${favicon > 0 ? '✓' : '✗ FALTA'}`);

        expect(title).toBeTruthy();
        expect(description).toBeTruthy();
        expect(viewport).toBeTruthy();
      });
    }
  });

  test.describe('3. Accesibilidad', () => {
    for (const pg of PAGES) {
      test(`${pg.name} - accesibilidad básica`, async ({ page }) => {
        await blockExternalRequests(page);
        await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const lang = await page.locator('html').getAttribute('lang');
        const h1Count = await page.locator('h1').count();
        const h1Texts = await page.locator('h1').allTextContents();

        const allImgs = await page.locator('img').all();
        const imgAltIssues = [];
        for (const img of allImgs) {
          const alt = await img.getAttribute('alt');
          const src = await img.getAttribute('src');
          if (alt === null) imgAltIssues.push(`SIN alt: ${src}`);
          else if (alt.trim() === '') imgAltIssues.push(`alt vacío: ${src}`);
        }

        const linksNoText = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a'))
            .filter(a => !a.textContent.trim() && !a.getAttribute('aria-label') && !a.querySelector('img'))
            .map(a => a.href).slice(0, 5);
        });

        const inputsNoLabel = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
          return inputs.filter(inp => {
            if (inp.type === 'hidden' || inp.type === 'submit' || inp.type === 'button') return false;
            const id = inp.id;
            return !id || !document.querySelector(`label[for="${id}"]`);
          }).map(inp => inp.name || inp.type);
        });

        const skipLinks = await page.locator('a[href="#main"], a[href="#content"], [class*="skip"]').count();
        const ariaLandmarks = await page.evaluate(() => ({
          main: document.querySelectorAll('main, [role="main"]').length,
          nav: document.querySelectorAll('nav, [role="navigation"]').length,
          header: document.querySelectorAll('header, [role="banner"]').length,
          footer: document.querySelectorAll('footer, [role="contentinfo"]').length,
        }));

        console.log(`\n  === ${pg.name} ===`);
        console.log(`  lang="${lang}": ${lang ? '✓' : '✗ FALTA'}`);
        console.log(`  H1: ${h1Count} (${h1Texts.map(t => `"${t.trim().slice(0,40)}"`).join(', ')}) ${h1Count === 1 ? '✓' : h1Count === 0 ? '✗ FALTA H1' : '⚠ MÚLTIPLES H1'}`);
        console.log(`  Imágenes sin alt: ${imgAltIssues.length === 0 ? '✓ Ninguna' : `✗ ${imgAltIssues.length}`}`);
        imgAltIssues.forEach(i => console.log(`    - ${i}`));
        console.log(`  Links sin texto: ${linksNoText.length === 0 ? '✓ Ninguno' : `⚠ ${linksNoText.length}`}`);
        console.log(`  Inputs sin label: ${inputsNoLabel.length === 0 ? '✓ Ninguno' : `✗ ${inputsNoLabel.join(', ')}`}`);
        console.log(`  Skip links: ${skipLinks > 0 ? '✓' : '⚠ FALTA (recomendado)'}`);
        console.log(`  ARIA landmarks - main:${ariaLandmarks.main} nav:${ariaLandmarks.nav} header:${ariaLandmarks.header} footer:${ariaLandmarks.footer}`);

        expect(lang).toBeTruthy();
        if (h1Count !== 1) {
          console.log(`  ⚠ NOTA: ${pg.name} tiene ${h1Count} H1 en el DOM (puede ser dinámico)`);
        }
      });
    }
  });

  test.describe('4. Navegación y Links', () => {
    test('Links internos desde Home', async ({ page }) => {
      await blockExternalRequests(page);
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 50), target: a.getAttribute('target'), rel: a.getAttribute('rel') }));
      });

      const internal = links.filter(l => !l.href?.startsWith('http') && !l.href?.startsWith('mailto') && !l.href?.startsWith('tel'));
      const external = links.filter(l => l.href?.startsWith('http'));

      console.log(`\n  Links internos (${internal.length}):`);
      internal.forEach(l => console.log(`    → "${l.text || '(sin texto)'}": ${l.href}`));

      console.log(`\n  Links externos (${external.length}):`);
      external.forEach(l => {
        const safe = l.rel?.includes('noopener') || l.rel?.includes('noreferrer');
        console.log(`    → "${l.text || '(sin texto)'}": ${l.href}`);
        console.log(`      target="${l.target}" rel="${l.rel}" ${safe ? '✓ seguro' : '⚠ falta noopener/noreferrer'}`);
      });

      expect(internal.length).toBeGreaterThan(0);
    });

    test('Verificación de páginas referenciadas en nav', async ({ page }) => {
      const navPages = ['/galpones.html', '/tinglados.html', '/obras.html', '/faq.html', '/contacto.html', '/celdas.html'];

      for (const path of navPages) {
        await blockExternalRequests(page);
        const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log(`  ${path}: HTTP ${response.status()} ${response.status() < 400 ? '✓' : '✗'}`);
        expect(response.status()).toBeLessThan(400);
      }
    });
  });

  test.describe('5. Responsividad Mobile', () => {
    const viewports = [
      { name: 'iPhone SE (320px)', width: 320, height: 568 },
      { name: 'iPhone 14 (390px)', width: 390, height: 844 },
      { name: 'iPad (768px)', width: 768, height: 1024 },
      { name: 'Desktop (1440px)', width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      test(`${vp.name}`, async ({ page }) => {
        await blockExternalRequests(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const overflow = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          return {
            bodyScrollWidth: body.scrollWidth,
            htmlScrollWidth: html.scrollWidth,
            clientWidth: html.clientWidth,
            hasHorizontalScroll: html.scrollWidth > html.clientWidth,
          };
        });

        console.log(`  ${vp.name}: clientWidth=${overflow.clientWidth}, scrollWidth=${overflow.htmlScrollWidth}, overflow=${overflow.hasHorizontalScroll ? '✗ TIENE scroll horizontal' : '✓ Sin scroll horizontal'}`);

        await page.screenshot({ path: `screenshots/responsive_${vp.width}px.png`, fullPage: false });
      });
    }
  });

  test.describe('6. Contenido y Estructura', () => {
    test('Estructura semántica de Home', async ({ page }) => {
      await blockExternalRequests(page);
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const structure = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
          .map(h => `${h.tagName}: "${h.textContent.trim().slice(0,60)}"`);

        const videos = Array.from(document.querySelectorAll('video')).map(v => ({
          src: v.querySelector('source')?.getAttribute('src') || v.getAttribute('src') || '?',
          autoplay: v.hasAttribute('autoplay'),
          muted: v.hasAttribute('muted'),
          loop: v.hasAttribute('loop'),
          playsinline: v.hasAttribute('playsinline'),
        }));

        const sections = Array.from(document.querySelectorAll('section, article, main, header, footer, nav, aside'))
          .map(el => `${el.tagName}${el.id ? '#'+el.id : ''}${el.className ? '.'+el.className.split(' ')[0] : ''}`);

        return { headings, videos, sections };
      });

      console.log('\n  Jerarquía de encabezados:');
      structure.headings.forEach(h => console.log(`    ${h}`));

      console.log(`\n  Videos (${structure.videos.length}):`);
      structure.videos.forEach((v, i) => {
        console.log(`    Video ${i+1}: ${v.src}`);
        console.log(`      autoplay=${v.autoplay} muted=${v.muted} loop=${v.loop} playsinline=${v.playsinline}`);
        if (!v.muted && v.autoplay) console.log(`      ⚠ AUTOPLAY SIN MUTE - puede fallar en browsers`);
      });

      console.log(`\n  Elementos semánticos:`);
      structure.sections.slice(0, 15).forEach(s => console.log(`    ${s}`));
    });

    test('Formulario de Contacto', async ({ page }) => {
      await blockExternalRequests(page);
      await page.goto(`${BASE_URL}/contacto.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const form = await page.evaluate(() => {
        const f = document.querySelector('form');
        if (!f) return null;
        return {
          action: f.action || '(ninguna)',
          method: f.method || '(ninguno)',
          hasValidation: f.getAttribute('novalidate') === null,
          fields: Array.from(f.querySelectorAll('input, textarea, select')).map(inp => ({
            type: inp.type || inp.tagName.toLowerCase(),
            name: inp.name,
            id: inp.id,
            required: inp.required,
            hasLabel: !!document.querySelector(`label[for="${inp.id}"]`),
            placeholder: inp.placeholder || '(sin placeholder)',
          })),
        };
      });

      if (form) {
        console.log(`\n  Formulario de Contacto:`);
        console.log(`  Action: ${form.action}`);
        console.log(`  Method: ${form.method}`);
        console.log(`  Validación nativa: ${form.hasValidation ? '✓' : '✗'}`);
        console.log(`  Campos:`);
        form.fields.forEach(f => {
          console.log(`    [${f.type}] name="${f.name}" required=${f.required} label=${f.hasLabel ? '✓' : '✗'}`);
        });
      } else {
        console.log('  ✗ No se encontró formulario');
      }

      expect(form).not.toBeNull();
    });

    test('Página de Obras - galería', async ({ page }) => {
      await blockExternalRequests(page);
      await blockExternalRequests(page);
      await page.goto(`${BASE_URL}/obras.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const gallery = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const cards = document.querySelectorAll('[class*="obra"], [class*="card"], [class*="project"]');
        return {
          totalImages: imgs.length,
          imgsWithAlt: imgs.filter(i => i.getAttribute('alt') !== null).length,
          imgsWithEmptyAlt: imgs.filter(i => i.getAttribute('alt') === '').length,
          cardCount: cards.length,
        };
      });

      console.log(`\n  Galería de Obras:`);
      console.log(`  Total imágenes: ${gallery.totalImages}`);
      console.log(`  Con alt: ${gallery.imgsWithAlt} ${gallery.imgsWithAlt === gallery.totalImages ? '✓' : '⚠'}`);
      console.log(`  Alt vacío: ${gallery.imgsWithEmptyAlt > 0 ? `⚠ ${gallery.imgsWithEmptyAlt}` : '✓ 0'}`);

      expect(gallery.totalImages).toBeGreaterThan(0);
    });
  });

  test.describe('7. Errores de Consola', () => {
    for (const pg of PAGES) {
      test(`${pg.name} - errores JS`, async ({ page }) => {
        await blockExternalRequests(page);
        const errors = [];
        const warnings = [];

        page.on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text());
          if (msg.type() === 'warning') warnings.push(msg.text());
        });
        page.on('pageerror', err => errors.push(`JS ERROR: ${err.message}`));

        await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        console.log(`\n  ${pg.name}:`);
        console.log(`  Errores: ${errors.length === 0 ? '✓ Ninguno' : `✗ ${errors.length}`}`);
        errors.forEach(e => console.log(`    ERROR: ${e.slice(0, 120)}`));
        console.log(`  Warnings: ${warnings.length === 0 ? '✓ Ninguno' : `⚠ ${warnings.length}`}`);
        warnings.slice(0, 3).forEach(w => console.log(`    WARN: ${w.slice(0, 100)}`));
      });
    }
  });

  test.describe('8. Rendimiento Estático', () => {
    test('Tamaño de recursos por página', async ({ page }) => {
      for (const pg of PAGES) {
        const resources = [];
        page.on('response', async response => {
          const url = response.url();
          const size = parseInt(response.headers()['content-length'] || '0');
          resources.push({ url: url.replace(BASE_URL, ''), status: response.status(), size });
        });

        await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const cssFiles = resources.filter(r => r.url.endsWith('.css'));
        const jsFiles = resources.filter(r => r.url.endsWith('.js'));
        const imgFiles = resources.filter(r => r.url.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i));
        const htmlSize = resources.find(r => r.url.includes(pg.path.replace('/', '')))?.size || 0;

        console.log(`\n  ${pg.name}:`);
        console.log(`  HTML size: ${htmlSize > 0 ? `${Math.round(htmlSize/1024)}KB` : '?'}`);
        console.log(`  CSS files: ${cssFiles.length}`);
        console.log(`  JS files: ${jsFiles.length}`);
        console.log(`  Imágenes cargadas: ${imgFiles.length}`);

        const broken404 = resources.filter(r => r.status === 404);
        if (broken404.length > 0) {
          console.log(`  ✗ Recursos rotos (404): ${broken404.length}`);
          broken404.forEach(r => console.log(`    404: ${r.url}`));
        } else {
          console.log(`  ✓ Sin recursos rotos`);
        }

        page.removeAllListeners('response');
      }
    });
  });

});
