/**
 * Student view is a mode carried in the URL (`?studentView=1`), not a
 * destination, so every hop that stays on a lesson has to preserve it. The
 * sidebar's lesson links dropped it, which silently returned a previewing
 * moderator to their own identity on the first click — grading panels and
 * instructor notes reappearing mid-course with no visible cause.
 */
import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentLessonSidebar from '@/components/StudentLessonSidebar.vue'

const query = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
const outline = vi.hoisted(() => ({
	current: [
		{
			name: 'CH-1',
			title: 'Chapter 1',
			lessons: [
				{ name: 'LESSON-1', title: 'Lesson 1', number: '1-1' },
				{ name: 'LESSON-2', title: 'Lesson 2', number: '1-2' },
			],
		},
	] as Array<Record<string, any>>,
}))

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: query.current }),
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('frappe-ui', () => ({
	createResource: () => ({
		data: outline.current,
		loading: false,
		reload: vi.fn(),
		fetch: vi.fn(),
	}),
	Progress: { template: `<div />` },
}))

vi.mock('@headlessui/vue', () => ({
	Disclosure: { template: `<div><slot :open="true" /></div>` },
	DisclosureButton: { template: `<button><slot /></button>` },
	DisclosurePanel: { template: `<div><slot /></div>` },
}))

vi.stubGlobal('__', (message: string) => {
	const translations: Record<string, string> = {
		'Available from {0}': 'Disponível a partir de {0}',
		'Available soon': 'Disponível em breve',
	}
	const translated = translations[message] || message
	return translated.includes('{0}')
		? { format: (value: string) => translated.replace('{0}', value) }
		: translated
})

const defaultOutline = () => [
	{
		name: 'CH-1',
		title: 'Chapter 1',
		lessons: [
			{ name: 'LESSON-1', title: 'Lesson 1', number: '1-1' },
			{ name: 'LESSON-2', title: 'Lesson 2', number: '1-2' },
		],
	},
]

beforeEach(() => {
	outline.current = defaultOutline()
})

function mountSidebar() {
	return mount(StudentLessonSidebar, {
		props: { courseName: 'course-1', courseTitle: 'Course 1' },
		global: {
			mocks: {
				__: (message: string) => {
					const translations: Record<string, string> = {
						'Available from {0}': 'Disponível a partir de {0}',
						'Available soon': 'Disponível em breve',
					}
					const translated = translations[message] || message
					return translated.includes('{0}')
						? { format: (value: string) => translated.replace('{0}', value) }
						: translated
				},
			},
			stubs: { 'router-link': RouterLinkStub },
		},
	})
}

function lessonLinkTargets(wrapper: ReturnType<typeof mountSidebar>) {
	return wrapper
		.findAllComponents(RouterLinkStub)
		.map((link) => link.props('to') as Record<string, any>)
		.filter((to) => to?.name === 'Lesson')
}

describe('StudentLessonSidebar lesson links', () => {
	it('carries ?studentView=1 onward while previewing', () => {
		query.current = { studentView: '1' }

		const targets = lessonLinkTargets(mountSidebar())

		expect(targets.length).toBeGreaterThan(0)
		for (const to of targets) {
			expect(to.query).toEqual({ studentView: 1 })
		}
	})

	it('leaves the query off for an ordinary student', () => {
		query.current = {}

		const targets = lessonLinkTargets(mountSidebar())

		expect(targets.length).toBeGreaterThan(0)
		for (const to of targets) {
			expect(to.query).toBeUndefined()
		}
	})

	it('ignores a studentView value that is not the flag', () => {
		query.current = { studentView: '0' }

		for (const to of lessonLinkTargets(mountSidebar())) {
			expect(to.query).toBeUndefined()
		}
	})

	it('renders only legacy and unlocked lessons as links', () => {
		query.current = {}
		outline.current = [
			{
				name: 'CH-1',
				title: 'Chapter 1',
				lessons: [
					{ name: 'LEGACY', title: 'Legacy lesson', number: '1-1' },
					{
						name: 'UNLOCKED',
						title: 'Unlocked lesson',
						number: '1-2',
						locked: 0,
					},
					{
						title: 'Dated locked lesson',
						number: '1-3',
						locked: 1,
						release_at: '2026-09-30T00:00:00Z',
					},
					{
						title: 'Generic locked lesson',
						number: '1-4',
						locked: 1,
						release_at: null,
					},
				],
			},
		]

		const wrapper = mountSidebar()
		const links = lessonLinkTargets(wrapper)

		expect(links).toHaveLength(2)
		expect(wrapper.findAll('.lucide-lock-keyhole')).toHaveLength(2)
		expect(wrapper.text()).toContain('Disponível a partir de 30/09/2026')
		expect(wrapper.text()).toContain('Disponível em breve')
		expect(wrapper.text()).toContain('Dated locked lesson')
		expect(wrapper.text()).toContain('Generic locked lesson')
	})
})
