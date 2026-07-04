const fs = require('fs')
let content = fs.readFileSync('tests/teknisi.test.ts', 'utf8')

content = content.replace("vi.stubGlobal('readBody', vi.fn())", "const mockReadBody = vi.fn();\nvi.stubGlobal('readBody', mockReadBody);")

content = content.replace(/vi\.doMock\('h3', \(\) => \(\{[\s\S]*?\}\)\)/g, 'mockReadBody.mockResolvedValue(event.body)')

fs.writeFileSync('tests/teknisi.test.ts', content)
