import { describe, expect, it } from 'vitest'
import { isSidebarItemEnabled } from '@/utils/sidebarSettings'

describe('sidebar settings visibility', () => {
	it('keeps new sidebar options enabled by default', () => {
		expect(isSidebarItemEnabled({ programs: 1 }, 'programs')).toBe(true)
		expect(isSidebarItemEnabled({ quizzes: '1' }, 'quizzes')).toBe(true)
		expect(isSidebarItemEnabled({ assignments: true }, 'assignments')).toBe(true)
	})

	it('hides disabled or missing options', () => {
		for (const key of ['programs', 'quizzes', 'assignments', 'programming_exercises']) {
			expect(isSidebarItemEnabled({ [key]: 0 }, key)).toBe(false)
			expect(isSidebarItemEnabled({}, key)).toBe(false)
		}
	})
})
