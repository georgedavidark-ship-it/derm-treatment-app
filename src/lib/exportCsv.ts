// CSV, а не .xlsx: пакет xlsx (SheetJS) на npm имеет незакрытые уязвимости
// (prototype pollution, ReDoS) без доступного фикса — CSV открывается в
// Excel без сторонних зависимостей (см. SPEC.md, раздел 3: «Excel/CSV»).
export function downloadCsv(filename: string, columns: string[], rows: Record<string, unknown>[]) {
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value)
    if (/["\n;]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [columns.join(';'), ...rows.map((row) => columns.map((col) => escape(row[col])).join(';'))]

  // BOM нужен, чтобы Excel корректно распознал кодировку UTF-8 (иначе
  // кириллица открывается «кракозябрами»).
  const BOM = String.fromCharCode(0xfeff)
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
