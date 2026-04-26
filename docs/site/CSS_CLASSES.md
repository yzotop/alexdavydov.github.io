# CSS Classes — style.css

Сгенерировано командой:
```bash
grep -E '^\.[a-z]' style.css | grep -v '@' | sed 's/{.*//' | sort -u
```

> **Важно:** команда захватывает только классы, объявленные в начале строки (top-level).
> Классы внутри `@media`-блоков (`.nav`, `.footer`, `.tag`, `.btn`, `.hero`, `.stat`, `.note`, `.course`, `.sec-link` и др.) в список не попадают, но в `style.css` они есть.
> Полный список всех классов (включая медиазапросы) — в разделе «Все классы (расширенный)» ниже.

---

## Top-level классы (вывод команды)

```
.article
.article .prose blockquote
.article .prose code
.article .prose h2
.article .prose h3
.article .prose p
.article h1
.article-author
.article-author b
.article-meta
.article-meta .chip
.author-av
.breadcrumb
.breadcrumb a
.breadcrumb a:hover
.case
.case h3
.case p
.case-co
.case-meta
.case-metric
.case-metric .m-lbl
.case-metric .m-num
.case:hover
.case:hover h3
.cases-grid
.ci-arrow
.ci-meta
.ci-meta .chip
.ci-num
.ci-title h3
.ci-title p
.course-item
.course-item:hover
.course-item:hover .ci-arrow
.course-item:hover h3
.course-list
.cta-strip
.cta-strip h3
.cta-strip p
.filter
.filter.active
.filter:hover
.filters
.footer-spacer
.nav-drawer
.nav-drawer-backdrop
.nav-drawer-backdrop.is-open
.nav-drawer-divider
.nav-drawer-section
.nav-drawer-section a
.nav-drawer-section--primary a
.nav-drawer-section--primary a:hover
.nav-drawer-section--primary a:not(:last-child)::after
.nav-drawer-section--secondary a
.nav-drawer-section--secondary a:hover
.nav-drawer-section--secondary a:not(:last-child)::after
.nav-drawer.is-open
.page
.page .meta-row
.page-lead
.page-lead .highlight
.page-sub
.page-title
.page-title .accent-dot
.plan
.plan h3
.plan ul
.plan ul li
.plan ul li::before
.plan-price
.plan-price .per
.plan-tag
.plan.feat
.plan.feat .plan-price .per
.plan.feat ul li
.plan.feat:hover
.plan:hover
.pricing
.prose p
.prose p strong
.prose ul
.prose ul li
.prose-grid
.prose-grid h4
.timeline
.tl-body
.tl-role
.tl-role .co
.tl-row
.tl-year
```

---

## Все классы (расширенный — включая @media)

```
accent-dot, active, arrow, article, article-author, article-meta,
author-av, banner, banner-left, banner-right, banner-tag, breadcrumb,
btn, btn-ghost, btn-primary, caret, case, case-co, case-meta,
case-metric, cases-grid, chev, chip, ci-arrow, ci-meta, ci-num,
ci-title, co, companies, companies-label, company, course,
course-arrow, course-item, course-list, course-meta, course-num,
courses-grid, courses-wrap, cta-strip, ctas, display, dot, feat,
filter, filters, footer, footer-center, footer-links, footer-right,
footer-spacer, grid12, hero, hero-lede, hero-right, hero-sub,
hero-title, highlight, in, is-open, kicker, logo, logo-mark,
m-lbl, m-num, manifesto, manifesto-kicker, manifesto-sub,
manifesto-text, meta-row, nav, nav-burger, nav-cta, nav-drawer,
nav-drawer-backdrop, nav-drawer-divider, nav-drawer-section,
nav-drawer-section--primary, nav-drawer-section--secondary, nav-links,
news, news-form, news-kicker, news-sub, note, note-arrow, note-cat,
note-date, note-read, note-title, notes-wrap, org, page, page-lead,
page-sub, page-title, per, plan, plan-price, plan-tag, portrait,
portrait-img, portrait-row, portrait-tag, pricing, prose, prose-grid,
reveal, sec-head, sec-kicker, sec-link, sec-right, sec-title, small,
stat, stat-idx, stat-lbl, stat-num, stats, tag, tags, test, test-by,
test-quote, test-stars, tests-grid, tests-wrap, tight, timeline,
tl-body, tl-role, tl-row, tl-year, w3
```
