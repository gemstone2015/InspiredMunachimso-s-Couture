function publicCache(seconds = 60) {
  return (_req, res, next) => {
    res.set("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    next();
  };
}

function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

module.exports = { publicCache, noStore };
