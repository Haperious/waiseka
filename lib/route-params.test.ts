import { describe, it, expect } from 'vitest'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { objectIdParam } from './route-params'

describe('objectIdParam', () => {
  it('returns the ObjectId for a valid id', async () => {
    const id = new ObjectId().toHexString()
    const result = await objectIdParam(Promise.resolve({ id }))
    expect(result).toBeInstanceOf(ObjectId)
    expect((result as ObjectId).toHexString()).toBe(id)
  })

  it('returns a 400 for an invalid id', async () => {
    const result = await objectIdParam(Promise.resolve({ id: 'not-an-id' }))
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(400)
  })
})
