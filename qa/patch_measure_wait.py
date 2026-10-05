p = 'qa/dev5-qa.mjs'
s = open(p, encoding='utf8').read()
old = '''  const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim().toLowerCase().includes("measure"));
  if (!b) return { found: false }; b.click(); return { found: true, panel: !!document.querySelector(".mv4-measure") };
})()`);'''
new = '''  const b = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim().toLowerCase().includes("measure"));
  if (!b) return { found: false }; b.click(); return { found: true };
})()`);
  await sleep(1200);
  const measurePanel = await ev(`(() => ({ panel: !!document.querySelector(".mv4-measure"), text: (document.querySelector(".mv4-measure")?.textContent ?? "").trim().slice(0, 60) }))()`);
  measure.panel = measurePanel.panel; measure.text = measurePanel.text;'''
assert old in s, "pattern not found"
s = s.replace(old, new)
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
