import { describe, expect, it } from 'vitest'
import { selectWorkspaceCompany } from './workspaceSelection'

const companyA = { id: 'a', slug: 'ingetec', name: 'INGETEC' }
const companyB = { id: 'b', slug: 'gestiqa', name: 'GESTIQA' }

describe('tenant-bound authentication', () => {
  it('allows an authorized user into their selected company', () => {
    expect(selectWorkspaceCompany([companyA], companyA, false)).toEqual(companyA)
  })

  it('does not silently switch a user into another company after logging in through the wrong portal', () => {
    expect(selectWorkspaceCompany([companyA], companyB, false)).toBeNull()
  })

  it('blocks a company user without an active membership', () => {
    expect(selectWorkspaceCompany([], companyB, false)).toBeNull()
  })

  it('only permits explicitly assigned multi-company membership', () => {
    expect(selectWorkspaceCompany([companyA, companyB], companyB, false)).toEqual(companyB)
  })

  it('supports legacy access without a selected portal for an assigned user', () => {
    expect(selectWorkspaceCompany([companyA], null, false)).toEqual(companyA)
  })

  it('keeps global administration able to choose or recover another workspace', () => {
    expect(selectWorkspaceCompany([companyA, companyB], companyB, true)).toEqual(companyB)
    expect(selectWorkspaceCompany([companyA, companyB], { slug: 'deleted' }, true)).toEqual(companyA)
  })
})
