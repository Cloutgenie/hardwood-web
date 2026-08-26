# Catalog data

`nba.json` and `college.json` are generated career cards. Rebuild them with:

```bash
npm run catalog
```

Sources:

- NBA/BAA season totals and bio: [sumitrodatta/bball-reference-datasets](https://github.com/sumitrodatta/bball-reference-datasets)
- College D1 2008–26: [Barttorvik](https://barttorvik.com) `getadvstats.php`
- Pre-2008 college legends and pre-stat-era defensive boosts: `lib/data/nba.ts` / `lib/data/college.ts`
