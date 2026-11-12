import { expect, it, vi } from 'vitest'
import { planHysFolderUpload, readHysDirectory, runHysFolderUpload } from './hysFolderUpload'

const entry = (path, size = 8) => ({
  parts: path.split('/'), file: { name: path.split('/').at(-1), size },
})
const makePlan = (...files) => planHysFolderUpload(files.map(path => entry(path)), 'Destino')
const createFolder = async folder => ({ id: folder.key, category: folder.category })
const upload = (plan, overrides = {}) => runHysFolderUpload(plan, {
  createFolder, uploadFile: vi.fn(), stopped: () => false, onChange: vi.fn(), ...overrides,
})

it('plans one file and counts bytes without changing the destination', async () => {
  const plan = makePlan('Capacitaciones/Presentación.pptx')
  expect(plan).toMatchObject({ root: 'Capacitaciones', count: 1, bytes: 8 })
  expect(plan.folders.map(folder => folder.category)).toEqual(['Destino / Capacitaciones'])
  const uploadFile = vi.fn()
  await upload(plan, { uploadFile })
  expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({
    parent: expect.objectContaining({ saved: { id: 'Capacitaciones', category: 'Destino / Capacitaciones' } }),
  }))
})

it('preserves nested and empty directories read by the native picker', async () => {
  const dir = (name, children) => ({ name, kind: 'directory', async *values() { yield* children } })
  const tree = dir('Curso', [dir('Enero', [dir('Vacía', []), {
    name: 'Asistencia.pdf', kind: 'file', getFile: async () => ({ name: 'Asistencia.pdf', size: 12 }),
  }])])
  const plan = planHysFolderUpload(await readHysDirectory(tree), '01 / ')
  expect(plan.folders.map(folder => folder.category)).toEqual([
    '01 / Curso', '01 / Curso / Enero', '01 / Curso / Enero / Vacía',
  ])
  expect(plan.files[0].parent.category).toBe('01 / Curso / Enero')
})

it('keeps identical names in separate folders and rejects duplicates in one folder', () => {
  const plan = makePlan('Curso/Enero/Lista.pdf', 'Curso/Febrero/Lista.pdf', 'Curso/Febrero/LISTA.pdf')
  expect(plan.count).toBe(2)
  expect(plan.files.map(file => file.status)).toEqual(['pending', 'pending', 'invalid'])
})

it('excludes unsupported, oversized, mismatched and unsafe paths before any write', () => {
  const plan = planHysFolderUpload([
    entry('Curso/Lista.pdf'), entry('Curso/programa.exe'), entry('Curso/pesado.pdf', 26214401),
    entry('Curso/../Lista.pdf'), entry('Curso/otra\\ruta/Lista.pdf'), entry('Ajena/Lista.pdf'),
    entry('Curso/video.mp4', 52428800), { parts: ['Curso', 'otro.pdf'], file: { name: 'Lista.pdf', size: 8 } },
  ], 'Destino')
  expect(plan.count).toBe(2)
  expect(plan.files.filter(item => item.status === 'invalid')).toHaveLength(6)
})

it('limits concurrent uploads and only retries failed files with their original IDs', async () => {
  const plan = makePlan(...Array.from({ length: 8 }, (_, i) => `Curso/${i}.pdf`))
  let active = 0
  let peak = 0
  const uploadFile = vi.fn(async item => {
    peak = Math.max(peak, ++active)
    await Promise.resolve()
    active--
    if (item.name === '3.pdf') throw new Error('Offline')
  })
  await upload(plan, { uploadFile })
  expect(peak).toBe(3)
  expect(plan.files.filter(item => item.status === 'done')).toHaveLength(7)
  const failedId = plan.files[3].id
  const retry = vi.fn()
  const mkdir = vi.fn(createFolder)
  await upload(plan, { uploadFile: retry, createFolder: mkdir })
  expect(retry).toHaveBeenCalledTimes(1)
  expect(retry).toHaveBeenCalledWith(expect.objectContaining({ name: '3.pdf', id: failedId }))
  expect(mkdir).not.toHaveBeenCalled()
})

it('pauses before scheduling more files and resumes only pending work', async () => {
  const plan = makePlan('Curso/1.pdf', 'Curso/2.pdf', 'Curso/3.pdf', 'Curso/4.pdf')
  let paused = false
  await upload(plan, { stopped: () => paused, uploadFile: async () => { paused = true } })
  expect(plan.files.map(item => item.status)).toEqual(['done', 'pending', 'pending', 'pending'])
  const retry = vi.fn()
  await upload(plan, { uploadFile: retry })
  expect(retry).toHaveBeenCalledTimes(3)
})

it('does not upload into a preexisting or unauthorized destination when folder creation fails', async () => {
  const plan = makePlan('Curso/1.pdf', 'Curso/Enero/2.pdf')
  const uploadFile = vi.fn()
  await upload(plan, { uploadFile, createFolder: async () => { throw { code: '42501' } } })
  expect(uploadFile).not.toHaveBeenCalled()
  expect(plan.folders[0].error).toMatch(/permiso/)
  expect(plan.files.map(item => item.status)).toEqual(['failed', 'failed'])
})
