import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Lesson from '@/pages/Lesson.vue'

const backend = vi.hoisted(() => ({
	outline: [] as Array<Record<string, any>>,
	lesson: {} as Record<string, any>,
}))

const requests = vi.hoisted(() => ({
	outline: vi.fn(),
	lesson: vi.fn(),
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	const component = { template: '<div><slot name="prefix" /><slot /></div>' }

	function createResource(options: Record<string, any>) {
		const resource = reactive({
			data: null as any,
			loading: false,
			promise: null as Promise<any> | null,
			abort: vi.fn(),
			reset: vi.fn(() => {
				resource.data = null
			}),
			update: vi.fn(),
			submit: vi.fn(
				(params = {}, temporaryOptions: Record<string, any> = {}) => {
					let data: any = null
					if (options.url === 'lms.lms.utils.get_course_outline') {
						requests.outline(params)
						data = backend.outline
					} else if (options.url === 'lms.lms.utils.get_lesson') {
						requests.lesson(params)
						data = backend.lesson
					}
					resource.data = data
					options.onSuccess?.(data)
					temporaryOptions.onSuccess?.(data)
					resource.promise = Promise.resolve(data)
					return resource.promise
				}
			),
			fetch: vi.fn(),
			reload: vi.fn(),
		})
		resource.fetch = resource.submit
		resource.reload = resource.submit
		return resource
	}

	return {
		Badge: component,
		Breadcrumbs: component,
		Button: component,
		TabButtons: component,
		Tooltip: component,
		call: vi.fn(),
		createResource,
		createListResource: () => ({
			data: [],
			update: vi.fn(),
			reload: vi.fn(),
		}),
		usePageMeta: vi.fn(),
		toast: { error: vi.fn(), warning: vi.fn() },
	}
})

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: {} }),
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/utils', () => ({
	enablePlyr: vi.fn(async () => []),
	getEditorTools: vi.fn(() => ({})),
	highlightText: vi.fn(),
	sanitizeEditorJs: vi.fn((value) => value),
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

vi.mock('@/stores/sidebar', () => ({
	useSidebar: () => ({ isSidebarCollapsed: false }),
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: { data: {}, promise: Promise.resolve() },
	}),
}))

vi.mock('@/utils/lessonProgress', () => ({
	isVideoComplete: vi.fn(() => false),
	resolveDwellSeconds: vi.fn(() => null),
	shouldStartDwellTimer: vi.fn(() => false),
	shouldAttachVideoFallback: vi.fn(() => false),
}))

vi.mock('@editorjs/editorjs', () => ({
	default: class {
		isReady = Promise.resolve()
	},
}))

vi.mock('@/utils/basePath', () => ({ getLmsRoute: (path: string) => path }))

vi.mock('@/composables/useStudentView', async () => {
	const { ref } = await import('vue')
	return {
		provideStudentView: (user: any) => ({
			isStudentView: ref(false),
			mockedUser: user,
		}),
	}
})

const componentStub = vi.hoisted(() => ({ template: '<div />' }))
vi.mock('@/components/LessonContent.vue', () => ({ default: componentStub }))
vi.mock('@/components/CourseInstructors.vue', () => ({
	default: componentStub,
}))
vi.mock('@/components/ProgressBar.vue', () => ({ default: componentStub }))
vi.mock('@/components/Discussions.vue', () => ({ default: componentStub }))
vi.mock('@/components/CertificationLinks.vue', () => ({
	default: componentStub,
}))
vi.mock('@/components/CourseOutline.vue', () => ({ default: componentStub }))
vi.mock('@/components/StudentLessonSidebar.vue', () => ({
	default: componentStub,
}))
vi.mock('@/components/UserAvatar.vue', () => ({ default: componentStub }))
vi.mock('@/components/Notes/Notes.vue', () => ({ default: componentStub }))
vi.mock('@/components/Notes/InlineLessonMenu.vue', () => ({
	default: componentStub,
}))

vi.stubGlobal('__', (message: string) => {
	const translations: Record<string, string> = {
		'This lesson will be released for you on {0}.':
			'Esta aula será liberada para você em {0}.',
		'This lesson will be released soon.': 'Esta aula será liberada em breve.',
		'Meanwhile, enjoy the lessons that are already available.':
			'Enquanto isso, aproveite as aulas que já estão disponíveis.',
		'Back to Course': 'Voltar ao curso',
	}
	const translated = translations[message] || message
	return translated.includes('{0}')
		? { format: (value: string) => translated.replace('{0}', value) }
		: translated
})

const availableLesson = () => ({
	name: 'LESSON-1',
	title: 'Available lesson content',
	course_title: 'Course 1',
	chapter_title: 'Chapter 1',
	membership: null,
	instructors: [],
	body: null,
	content: null,
	prev: null,
	next: null,
	videos: [],
})

const mountLesson = (chapterNumber = '1', lessonNumber = '1') =>
	mount(Lesson, {
		props: {
			courseName: 'COURSE-1',
			chapterNumber,
			lessonNumber,
		},
		global: {
			mocks: {
				__: (message: string) => {
					const translations: Record<string, string> = {
						'This lesson will be released for you on {0}.':
							'Esta aula será liberada para você em {0}.',
						'This lesson will be released soon.':
							'Esta aula será liberada em breve.',
						'Meanwhile, enjoy the lessons that are already available.':
							'Enquanto isso, aproveite as aulas que já estão disponíveis.',
						'Back to Course': 'Voltar ao curso',
					}
					const translated = translations[message] || message
					return translated.includes('{0}')
						? { format: (value: string) => translated.replace('{0}', value) }
						: translated
				},
			},
			provide: {
				$user: { data: { name: 'student@example.com' } },
				$socket: { on: vi.fn() },
			},
			stubs: { 'router-link': RouterLinkStub },
		},
	})

beforeEach(() => {
	requests.outline.mockReset()
	requests.lesson.mockReset()
	backend.outline = []
	backend.lesson = availableLesson()
})

describe('Lesson progressive release preflight', () => {
	it('shows a dated lock and never requests lesson content', async () => {
		backend.outline = [
			{
				lessons: [
					{
						title: 'Locked lesson',
						number: '1-2',
						locked: 1,
						release_at: '2026-09-15T23:59:00-03:00',
					},
				],
			},
		]

		const wrapper = mountLesson('1', '2')
		await flushPromises()

		expect(requests.outline).toHaveBeenCalledOnce()
		expect(requests.lesson).not.toHaveBeenCalled()
		expect(
			wrapper.get('[data-testid="progressive-lesson-locked"]').text()
		).toContain('Esta aula será liberada para você em 15/09/2026.')
		expect(wrapper.text()).toContain(
			'Enquanto isso, aproveite as aulas que já estão disponíveis.'
		)
		expect(wrapper.find('.lucide-lock-keyhole').exists()).toBe(true)
		expect(wrapper.find('#editor').exists()).toBe(false)
	})

	it('shows the generic message for a nameless lock without a date', async () => {
		backend.outline = [
			{
				lessons: [
					{
						title: 'Locked lesson without date',
						number: '1-2',
						locked: 1,
						release_at: null,
					},
				],
			},
		]

		const wrapper = mountLesson('1', '2')
		await flushPromises()

		expect(requests.lesson).not.toHaveBeenCalled()
		expect(wrapper.text()).toContain('Locked lesson without date')
		expect(wrapper.text()).toContain('Esta aula será liberada em breve.')
		expect(wrapper.text()).toContain(
			'Enquanto isso, aproveite as aulas que já estão disponíveis.'
		)
	})

	it.each([
		['an explicitly unlocked course', { locked: 0 }],
		['a legacy course', {}],
	])('keeps native loading for %s', async (_label, accessFields) => {
		backend.outline = [
			{
				lessons: [
					{
						name: 'LESSON-1',
						title: 'Available lesson',
						number: '1-1',
						...accessFields,
					},
				],
			},
		]

		const wrapper = mountLesson()
		await flushPromises()

		expect(requests.lesson).toHaveBeenCalledOnce()
		expect(requests.lesson).toHaveBeenCalledWith({
			course: 'COURSE-1',
			chapter: '1',
			lesson: '1',
		})
		expect(wrapper.text()).toContain('Available lesson content')
		expect(
			wrapper.find('[data-testid="progressive-lesson-locked"]').exists()
		).toBe(false)
	})

	it('removes old content before checking a newly blocked route', async () => {
		backend.outline = [
			{
				lessons: [{ name: 'LESSON-1', title: 'Available', number: '1-1' }],
			},
		]
		const wrapper = mountLesson()
		await flushPromises()
		expect(wrapper.text()).toContain('Available lesson content')

		backend.outline = [
			{
				lessons: [
					{
						title: 'New locked lesson',
						number: '1-2',
						locked: 1,
						release_at: null,
					},
				],
			},
		]
		await wrapper.setProps({ lessonNumber: '2' })
		await flushPromises()

		expect(requests.lesson).toHaveBeenCalledTimes(1)
		expect(wrapper.text()).not.toContain('Available lesson content')
		expect(wrapper.text()).toContain('New locked lesson')
	})
})
