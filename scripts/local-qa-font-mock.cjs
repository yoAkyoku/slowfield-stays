// Local QA only. Never use this fixture for deployment or font acceptance.
module.exports = new Proxy({}, {
  get(_target, url) {
    if (typeof url !== 'string' || !url.startsWith('https://fonts.googleapis.com/')) return undefined;
    const family = new URL(url).searchParams.get('family').split(':')[0];
    return `/* latin */\n@font-face { font-family: '${family}'; font-style: normal; font-weight: 400; src: url(/Windows/Fonts/times.ttf) format('truetype'); }`;
  }
});
