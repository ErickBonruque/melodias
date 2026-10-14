import Dexie, { type EntityTable } from 'dexie'
import type { Melody } from '../music/types'

export const db = new Dexie('melodias') as Dexie & {
  melodies: EntityTable<Melody, 'id'>
}

db.version(1).stores({
  melodies: 'id, updatedAt, *tags',
})
