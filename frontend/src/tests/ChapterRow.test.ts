import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChapterRow from '@/components/ChapterRow.vue'

const pushMock = vi.hoisted(() => vi.fn())

const translate = (message: string) => {
	const translations: Record<string, string> = {
		'Available from {0}': 'Disponível a partir de {0}',
		'Available soon': 'Disponível em breve',
	}
	const translated = translations[message] || message
	return translated.includes('{0}')
		? { format: (value: string) => translated.replace('{0}', value) }
		: translated
}

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: {} }),
	useRouter: () => ({ push: pushMock }),
}))

vi.mock('frappe-ui', () => ({
	Button: {
		template: `<button><slot name="prefix" /><slot /></button>`,
	},
	TextInput: {
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template: `
			<div>
				<input
					:value="modelValue"
					@input="$emit('update:modelValue', $event.target.value)"
				/>
			</div>
		`,
	},
	Tooltip: {
		template: `<span><slot /></span>`,
	},
	toast: {
		success: vi.fn(),
	},
}))

vi.mock('vuedraggable', () => ({
	default: {
		props: ['list'],
		template: `
			<div>
				<div v-for="item in list" :key="item.name || item.number">
					<slot name="item" :element="item" />
				</div>
			</div>
		`,
	},
}))

vi.stubGlobal('__', translate)

const chapter = {
	name: 'CH-2',
	title: 'Old Chapter',
	idx: 2,
	is_scorm_package: 0 as const,
	lessons: [{ name: 'LESSON-1', title: 'Lesson 1', number: '2-1' }],
}

const mountRow = () =>
	mount(ChapterRow, {
		props: {
			chapter,
			index: 1,
			courseName: 'course-1',
			allowEdit: true,
		},
		global: {
			mocks: { __: translate },
			provide: { $user: { data: { name: 'admin@example.com' } } },
		},
	})

const mountStudentRow = (lesson: Record<string, unknown>) =>
	mount(ChapterRow, {
		props: {
			chapter: {
				name: 'CH-1',
				title: 'Chapter 1',
				idx: 1,
				is_scorm_package: 0,
				lessons: [lesson],
			},
			index: 0,
			courseName: 'course-1',
		},
		global: {
			mocks: { __: translate },
			provide: { $user: { data: { name: 'student@example.com' } } },
			stubs: { 'router-link': RouterLinkStub },
		},
	})

const lessonLinks = (wrapper: ReturnType<typeof mountStudentRow>) =>
	wrapper
		.findAllComponents(RouterLinkStub)
		.filter((link) => (link.props('to') as { name?: string })?.name === 'Lesson')

beforeEach(() => {
	pushMock.mockReset()
})

describe('ChapterRow inline rename', () => {
	it('commits on Enter without toggling the chapter disclosure', async () => {
		const wrapper = mountRow()

		expect(wrapper.text()).not.toContain('Lesson 1')
		await wrapper.get('[title="Old Chapter"]').trigger('dblclick')

		const input = wrapper.get('input')
		await input.setValue('Renamed Chapter')
		await input.trigger('keydown.enter')

		expect(wrapper.emitted('rename-chapter')?.[0]).toMatchObject([
			{ chapter, title: 'Renamed Chapter' },
		])
		expect(wrapper.text()).not.toContain('Lesson 1')
	})
})

describe('ChapterRow progressive release', () => {
	it.each([
		['legacy lesson', undefined],
		['explicitly unlocked lesson', 0],
	])('keeps a %s navigable', (_label, locked) => {
		const wrapper = mountStudentRow({
			name: 'LESSON-1',
			title: 'Available lesson',
			number: '1-1',
			...(locked === undefined ? {} : { locked }),
		})

		expect(lessonLinks(wrapper)).toHaveLength(1)
		expect(lessonLinks(wrapper)[0].props('to')).toMatchObject({
			name: 'Lesson',
			params: {
				courseName: 'course-1',
				chapterNumber: '1',
				lessonNumber: '1',
			},
		})
	})

	it('renders a dated lock without a lesson link', () => {
		const wrapper = mountStudentRow({
			title: 'Locked lesson',
			number: '1-2',
			locked: 1,
			release_at: '2026-09-15T23:30:00-03:00',
		})

		expect(lessonLinks(wrapper)).toHaveLength(0)
		expect(wrapper.find('.lucide-lock-keyhole').exists()).toBe(true)
		expect(wrapper.text()).toContain('Locked lesson')
		expect(wrapper.text()).toContain('Disponível a partir de 15/09/2026')
	})

	it('renders the generic message when a nameless locked lesson has no date', () => {
		const wrapper = mountStudentRow({
			title: 'Nameless locked lesson',
			number: '1-3',
			locked: 1,
			release_at: null,
		})

		expect(lessonLinks(wrapper)).toHaveLength(0)
		expect(wrapper.text()).toContain('Nameless locked lesson')
		expect(wrapper.text()).toContain('Disponível em breve')
	})
})
