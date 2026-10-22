// 分享链接落地页：…/open/?4454.0 → 尝试用 tape:// 唤起 TapeDeck，没装的话显示下载按钮。
// 也能打开 TapeDeck 自己的页面：…/open/?tapedeck/campaigns → tape://tapedeck/campaigns（链上推广活动），
// 页面名只认 PAGES 里的几个（和 TapeDeck 的 APP_PAGES 一致）。
// 只解析链接里的电路地址，不读链，不发任何请求。
'use strict';
(function () {
  // 区号 → 链（和 TapeDeck 一致：BNB Chain 不带区号，X Layer 2，Base 3）
  const CHAINS = { '': { name: 'BNB Chain', cls: 'bnb' }, 2: { name: 'X Layer', cls: 'xlayer' }, 3: { name: 'Base', cls: 'base' } };
  const EN = {
    eyebrow: 'DeWEB site',
    trying: 'Opening in TapeDeck…',
    opened: 'Handed off to TapeDeck. If nothing happened, use the buttons below to try again.',
    need: 'This site lives on-chain and opens in TapeDeck, which reads and verifies the site files straight from the chain, with no gateway server in between.',
    download: 'Download TapeDeck',
    retry: 'Installed? Try again',
    addr: 'Site address: ',
    badTitle: 'This link has no valid site address',
    badBody: 'Share links look like …/open/?4454.0. Circuit addresses such as 1.2.248 (X Layer) or 1.3.5 (Base) work too.',
    home: 'About TapeDeck',
    mac: 'For macOS, download the Apple chip build (.dmg).',
    win: 'For Windows, download the x64 installer (.exe).',
    linux: 'For Linux, download the AppImage.',
    other: 'TapeDeck is a desktop app for macOS, Windows and Linux. Open this link on a computer.',
    title: 'Open {label} in TapeDeck',
  };
  const ZH = {
    mac: 'macOS 请下载 Apple 芯片版本（.dmg）。',
    win: 'Windows 请下载 x64 安装包（.exe）。',
    linux: 'Linux 请下载 AppImage。',
    other: 'TapeDeck 是 macOS、Windows、Linux 上的桌面应用，请在电脑上打开这个链接。',
    title: '在 TapeDeck 中打开 {label}',
  };
  // TapeDeck 自己的页面：名字、显示的标题
  const PAGES = {
    campaigns: { zh: '链上推广活动', en: 'On-chain campaigns', eyebrowZh: 'TapeDeck 页面', eyebrowEn: 'TapeDeck page' },
    seal: { zh: '封存一段话', en: 'Seal a statement', eyebrowZh: 'TapeDeck 页面', eyebrowEn: 'TapeDeck page' },
  };
  const en = !/^zh/i.test(navigator.language || '');
  const t = (k) => (en ? EN[k] : ZH[k]);
  const $ = (id) => document.getElementById(id);

  if (en) {
    document.documentElement.lang = 'en';
    for (const el of document.querySelectorAll('[data-i18n]')) if (EN[el.dataset.i18n]) el.textContent = EN[el.dataset.i18n];
  }

  /**
   * ?4454.0、?4454-0、?1.2.248、?site=1.2.248，可带路径：?4454.0/docs/
   * 返回 {label, tape} 或 null。只接受数字和分隔符组成的电路地址，路径只允许常见的网址字符
   */
  function parse(search) {
    let q;
    try { q = decodeURIComponent(search.replace(/^\?/, '').replace(/^site=/, '')).trim(); } catch { return null; }
    const pm = /^tapedeck\/([a-z]+)\/?$/i.exec(q);
    if (pm) {
      const p = PAGES[pm[1].toLowerCase()];
      return p ? { page: true, label: en ? p.en : p.zh, eyebrow: en ? p.eyebrowEn : p.eyebrowZh, tape: `tape://tapedeck/${pm[1].toLowerCase()}` } : null;
    }
    q = q.replace(/^tape:\/\//i, '').replace(/^#/, '');
    const m = /^([1-9]\d*)[-.@](?:(\d+)[-.])?(0|[1-9]\d*)(?:\.tape)?(\/[\w\-./~%]*)?$/i.exec(q);
    if (!m) return null;
    const area = m[2] === undefined ? '' : m[2];
    if (!CHAINS[area]) return null;
    const host = [m[1], area, m[3]].filter((x) => x !== '').join('-');
    return {
      label: [m[1], area, m[3]].filter((x) => x !== '').join('.') + '.tape',
      chain: CHAINS[area],
      tape: `tape://${host}${m[4] || '/'}`,
    };
  }

  const site = parse(location.search);
  if (!site) { $('invalid').hidden = false; return; }

  $('site').hidden = false;
  $('label').textContent = site.label;
  if (site.page) {
    // TapeDeck 自己的页面：没有链，地址那一行写 tape://tapedeck/…
    $('chain').parentElement.hidden = true;
    document.querySelector('[data-i18n="eyebrow"]').textContent = site.eyebrow;
    document.querySelector('[data-i18n="need"]').textContent = en
      ? 'This page is part of TapeDeck. Wallet actions only happen inside TapeDeck, so a copycat web page can never get your signature.'
      : '这个页面在 TapeDeck 里。钱包操作只在 TapeDeck 里进行，仿冒的网页拿不到你的签名。';
  } else {
    $('chain').textContent = site.chain.name;
    $('chain').classList.add(site.chain.cls);
  }
  $('tape').textContent = site.tape;
  document.title = t('title').replace('{label}', site.label);

  const ua = navigator.userAgent;
  const os = /Android|iPhone|iPad|iPod/i.test(ua) ? 'other' : /Mac/i.test(ua) ? 'mac' : /Win/i.test(ua) ? 'win' : /Linux/i.test(ua) ? 'linux' : 'other';
  $('platform').textContent = t(os);

  // 唤起后浏览器会失去焦点或页面被隐藏（弹出「要打开 TapeDeck 吗」也会失焦），据此判断有没有接住
  let handled = false;
  const onLeave = () => {
    if (handled) return;
    handled = true;
    $('trying').hidden = true;
    $('opened').hidden = false;
    $('fallback').hidden = false;
  };
  function launch() {
    handled = false;
    window.addEventListener('blur', onLeave, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) onLeave(); }, { once: true });
    location.href = site.tape;
    setTimeout(() => {
      if (handled) return;
      handled = true;
      $('trying').hidden = true;
      $('fallback').hidden = false;
    }, 1500);
  }

  $('retry').addEventListener('click', (e) => { e.preventDefault(); launch(); });
  // 手机上没有 TapeDeck，不尝试唤起
  if (os === 'other') { $('trying').hidden = true; $('fallback').hidden = false; $('retry').hidden = true; } else launch();
})();
