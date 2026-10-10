// Overestimate reachability (ignore counts and quality) to preserve valid recipes.
export function searchFilter(category, pool, filters = {}) {
 const axes = ['base', 'prefix', 'suffix'].map(axis => {
  const table = category.axes[axis];
  const values = axis === 'base' ? [...(table?.values || [])] : ['', ...(table?.values || [])];
  const selected = filters[axis] || 'all';
  const allowed = axis === 'base' ? filters.allowedBases?.[category.id] : undefined;
  const matches = value => (selected === 'all' || (selected === 'any' ? Boolean(value) : selected === 'none' ? !value : value === selected)) && (!allowed || allowed.includes(value));
  const targets = new Set(values.filter(matches));
  const edges = [];
  for (let i = 0; i < values.length; i++) for (let j = i; j < values.length; j++) {
   const a = values[i], b = values[j];
   if (axis !== 'base' && (!a || !b)) { edges.push([a, b, '']); continue; }
   if (table?.blocked.includes([a,b].sort((x,y)=>table.values.indexOf(x)-table.values.indexOf(y)).join('|'))) continue;
   const result = table?.table[a+'|'+b];
   if (result) edges.push([a,b,result]);
  }
  const reachable = new Set(pool.map(item => item[axis] || ''));
  let changed = true;
  while (changed) { changed = false; for (const [a,b,result] of edges) if (reachable.has(a) && reachable.has(b) && !reachable.has(result)) { reachable.add(result); changed = true; } }
  const useful = new Set([...targets].filter(value => reachable.has(value)));
  changed = true;
  while (changed) { changed = false; for (const [a,b,result] of edges) if (useful.has(result) && reachable.has(a) && reachable.has(b)) for (const value of [a,b]) if (!useful.has(value)) { useful.add(value); changed = true; } }
  return {axis, targets, useful};
 });
 return {
  matches: item => axes.every(({axis,targets}) => targets.has(item[axis] || '')),
  useful: item => axes.every(({axis,useful}) => useful.has(item[axis] || ''))
 };
}
