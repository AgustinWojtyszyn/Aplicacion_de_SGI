import { validateHysFile } from './hysFileTypes'
import { normalizeHysFolder } from '../services/hysService'

const keyFor = parts => parts.join('/')
const canonical = value => value.normalize('NFC').toLocaleLowerCase('es')

function validateName(name, max) {
  if (!name || name === '.' || name === '..' || name !== name.trim() ||
      name.length > max || /[/\\\u0000-\u001f\u007f]/u.test(name)) {
    throw new Error('El nombre contiene caracteres no admitidos o es demasiado largo.')
  }
}

export function entriesFromDirectoryInput(files) {
  return Array.from(files, file => ({ file, parts: (file.webkitRelativePath || '').split('/') }))
}

export async function readHysDirectory(handle) {
  const entries = []
  async function visit(directory, parts) {
    entries.push({ parts })
    for await (const child of directory.values()) {
      const path = [...parts, child.name]
      if (child.kind === 'directory') {
        await visit(child, path)
      } else {
        try {
          entries.push({ parts: path, file: await child.getFile() })
        } catch {
          entries.push({ parts: path, unreadable: true })
        }
      }
    }
  }
  await visit(handle, [handle.name])
  return entries
}

export function planHysFolderUpload(entries, destination) {
  if (!entries.length) throw new Error('La carpeta está vacía o el navegador no pudo leer su contenido.')
  const root = entries[0].parts[0]
  validateName(root, 90)
  const folders = new Map()
  const folderPaths = new Set()
  const filePaths = new Set()
  const files = []

  function folderFor(parts) {
    const key = keyFor(parts)
    if (folders.has(key)) return folders.get(key)
    const parent = parts.length > 1 ? folderFor(parts.slice(0, -1)) : null
    const name = parts.at(-1)
    const item = { key, parent, name, depth: parts.length, status: 'pending' }
    folders.set(key, item)
    try {
      if (parent?.status === 'invalid') throw new Error(parent.error)
      validateName(name, 90)
      item.parentCategory = parent?.category ?? destination
      item.category = normalizeHysFolder({ name, parentCategory: item.parentCategory }).category
      const path = canonical(item.category)
      if (folderPaths.has(path)) throw new Error('Hay otra carpeta con ese nombre en la misma ubicación.')
      folderPaths.add(path)
    } catch (error) {
      Object.assign(item, { status: 'invalid', error: error.message })
    }
    return item
  }

  for (const { parts, file, unreadable } of entries) {
    const item = { key: keyFor(parts), name: parts.at(-1), file, depth: parts.length, status: 'pending' }
    try {
      if (parts[0] !== root || (file && (parts.length < 2 || item.name !== file.name))) {
        throw new Error('El archivo no pertenece a la carpeta seleccionada.')
      }
      if (unreadable) throw new Error('No se pudo leer el archivo en tu computadora.')
      if (!file) {
        folderFor(parts)
        continue
      }
      item.parent = folderFor(parts.slice(0, -1))
      if (item.parent.status === 'invalid') throw new Error(item.parent.error)
      validateName(item.name, 255)
      if (!item.name.includes('.')) throw new Error('El archivo no tiene una extensión admitida.')
      validateHysFile(file)
      const path = canonical(item.key)
      if (filePaths.has(path)) throw new Error('Hay otro archivo con ese nombre en la misma ubicación.')
      filePaths.add(path)
    } catch (error) {
      Object.assign(item, { status: 'invalid', error: error.message })
    }
    files.push(item)
  }
  const eligible = files.filter(file => file.status === 'pending')
  return { root, folders: [...folders.values()], files, count: eligible.length,
    bytes: eligible.reduce((sum, item) => sum + item.file.size, 0) }
}

export function hysFolderUploadError(error) {
  const message = error?.message || ''
  if (['PGRST205', 'PGRST202', '42P01'].includes(error?.code)) return 'La carga de carpetas todavía no está habilitada. Avisá a quien administra GESTIQA.'
  if (/duplicate|ya existe/i.test(message) || error?.code === '23505') return 'Ya existe un elemento con ese nombre. No se reemplazó.'
  if (error?.code === '42501' || /permission|permiso|row.level|unauthorized/i.test(message)) return 'La carpeta cambió o ya no tenés permiso para escribir en ella.'
  if (/size|demasiado|supera/i.test(message)) return 'El archivo supera el tamaño permitido.'
  return 'No se pudo guardar. Revisá tu conexión y volvé a intentar.'
}

export async function runHysFolderUpload(plan, { createFolder, uploadFile, stopped, onChange }) {
  async function process(item, save) {
    item.status = 'working'
    item.error = ''
    onChange()
    try {
      if (item.parent && item.parent.status !== 'done') throw new Error('No se pudo crear la carpeta que lo contiene.')
      await save()
      item.status = 'done'
    } catch (error) {
      item.status = 'failed'
      item.error = item.parent && item.parent.status !== 'done'
        ? 'No se pudo crear la carpeta que lo contiene.'
        : hysFolderUploadError(error)
    }
    onChange()
  }
  const needsWork = item => item.status === 'pending' || item.status === 'failed'
  for (const folder of plan.folders.filter(needsWork)) {
    if (stopped()) return
    await process(folder, async () => {
      folder.saved = await createFolder(folder)
    })
  }
  const files = plan.files.filter(needsWork)
  let next = 0
  async function worker() {
    while (!stopped() && next < files.length) {
      const item = files[next++]
      await process(item, () => {
        item.id ??= crypto.randomUUID()
        return uploadFile(item)
      })
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker))
}
