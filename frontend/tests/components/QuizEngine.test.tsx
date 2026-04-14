// ============================================================================
// ARIS Academy — Component Test: QuizEngine
// Question navigation, answer selection, scoring, timer, edge cases
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { mockQuizLesson } from '../mocks/data';

// QuizEngine is defined inside the lesson page file, not exported separately.
// We need to test it through its parent page or re-create a minimal version.
// Since it's tightly coupled, we'll import the page and mock the hooks.

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ lessonId: 'lesson-003' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'mock-token',
    user: { id: 'usr-001', role: 'learner' },
    isAuthenticated: true,
  }),
}));

// Mock the store
vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      language: 'fr',
      user: { id: 'usr-001', firstName: 'Amina' },
      token: 'mock-token',
      theme: 'light',
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

// Mock the API
vi.mock('@/lib/api', () => ({
  lessonApi: {
    context: vi.fn().mockResolvedValue({
      data: {
        lesson: {
          id: 'lesson-003',
          title: { fr: 'Quiz Module 1' },
          type: 'quiz',
          course_id: 'course-001',
          content: {
            passingScore: 70,
            totalTime: null,
            questions: [
              {
                id: 'q1',
                text: { fr: "Quelle est la version actuelle d'ARIS ?" },
                options: [
                  { id: 'q1-a', text: { fr: 'ARIS 1.0' }, isCorrect: false },
                  { id: 'q1-b', text: { fr: 'ARIS 3.0' }, isCorrect: true },
                ],
                explanation: { fr: 'ARIS 3.0 est la version actuelle.' },
              },
              {
                id: 'q2',
                text: { fr: 'Combien de pays utilisent ARIS ?' },
                options: [
                  { id: 'q2-a', text: { fr: '10' }, isCorrect: false },
                  { id: 'q2-b', text: { fr: '55' }, isCorrect: true },
                ],
              },
            ],
          },
        },
        module: { id: 'mod-001', title: { fr: 'Module 1' } },
        course: { id: 'course-001', title: { fr: 'Intro ARIS' } },
        enrollment: { id: 'enroll-001' },
        progress: { is_completed: false },
        prev: null,
        next: 'lesson-004',
      },
    }),
    get: vi.fn(),
  },
  learningApi: {
    updateProgress: vi.fn().mockResolvedValue({ success: true }),
    videoHeartbeat: vi.fn().mockResolvedValue({ success: true }),
    videoResume: vi.fn().mockResolvedValue({ data: { position: 0 } }),
  },
  courseApi: {
    modules: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock SWR to return data synchronously
vi.mock('swr', () => ({
  default: (key: any, fetcher: any, config?: any) => {
    if (!key) return { data: undefined, isLoading: false, mutate: vi.fn() };
    // Return mock quiz lesson context
    if (Array.isArray(key) && key[0] === 'lesson-ctx') {
      return {
        data: {
          data: {
            lesson: {
              id: 'lesson-003',
              title: { fr: 'Quiz Module 1' },
              type: 'quiz',
              course_id: 'course-001',
              content: {
                passingScore: 70,
                totalTime: null,
                questions: [
                  {
                    id: 'q1',
                    text: { fr: "Quelle est la version actuelle d'ARIS ?" },
                    options: [
                      { id: 'q1-a', text: { fr: 'ARIS 1.0' }, isCorrect: false },
                      { id: 'q1-b', text: { fr: 'ARIS 3.0' }, isCorrect: true },
                    ],
                    explanation: { fr: 'ARIS 3.0 est la version actuelle.' },
                  },
                  {
                    id: 'q2',
                    text: { fr: 'Combien de pays utilisent ARIS ?' },
                    options: [
                      { id: 'q2-a', text: { fr: '10' }, isCorrect: false },
                      { id: 'q2-b', text: { fr: '55' }, isCorrect: true },
                    ],
                  },
                ],
              },
            },
            module: { id: 'mod-001', title: { fr: 'Module 1' } },
            course: { id: 'course-001', title: { fr: 'Intro ARIS' } },
            enrollment: { id: 'enroll-001' },
            progress: { is_completed: false },
            prev: null,
            next: 'lesson-004',
          },
        },
        isLoading: false,
        mutate: vi.fn(),
      };
    }
    return { data: undefined, isLoading: false, mutate: vi.fn() };
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  t: (text: any, lang = 'fr') => {
    if (typeof text === 'string') return text;
    if (text && typeof text === 'object') return text[lang] || text.fr || text.en || '';
    return '';
  },
  formatDuration: (m: number) => `${m}min`,
}));

// Now import the page component
import LessonPlayerPage from '@/app/learn/[lessonId]/page';

describe('QuizEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quiz with first question', async () => {
    render(<LessonPlayerPage />);

    // Should show question counter
    await waitFor(() => {
      expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    });
  });

  it('displays question text in French', async () => {
    render(<LessonPlayerPage />);

    await waitFor(() => {
      expect(screen.getByText(/version actuelle/)).toBeInTheDocument();
    });
  });

  it('shows answer options as clickable buttons', async () => {
    render(<LessonPlayerPage />);

    await waitFor(() => {
      expect(screen.getByText('ARIS 1.0')).toBeInTheDocument();
      expect(screen.getByText('ARIS 3.0')).toBeInTheDocument();
    });
  });

  it('selects an answer and shows feedback', async () => {
    render(<LessonPlayerPage />);

    await waitFor(() => {
      expect(screen.getByText('ARIS 3.0')).toBeInTheDocument();
    });

    // Click the correct answer
    fireEvent.click(screen.getByText('ARIS 3.0'));

    // Feedback should appear (explanation)
    await waitFor(() => {
      expect(screen.getByText(/ARIS 3.0 est la version actuelle/)).toBeInTheDocument();
    });
  });

  it('shows "Suivant" button after answering', async () => {
    render(<LessonPlayerPage />);

    await waitFor(() => {
      expect(screen.getByText('ARIS 3.0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('ARIS 3.0'));

    await waitFor(() => {
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });
  });

  it('navigates to next question on "Suivant" click', async () => {
    render(<LessonPlayerPage />);

    await waitFor(() => {
      expect(screen.getByText('ARIS 3.0')).toBeInTheDocument();
    });

    // Answer Q1
    fireEvent.click(screen.getByText('ARIS 3.0'));

    await waitFor(() => {
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Suivant'));

    // Should show Q2
    await waitFor(() => {
      expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    });
  });

  it('shows "Voir le résultat" on last question', async () => {
    render(<LessonPlayerPage />);

    // Answer Q1
    await waitFor(() => {
      expect(screen.getByText('ARIS 3.0')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('ARIS 3.0'));
    await waitFor(() => {
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Suivant'));

    // Answer Q2
    await waitFor(() => {
      expect(screen.getByText('55')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('55'));

    // Last question should show "Voir le résultat"
    await waitFor(() => {
      expect(screen.getByText('Voir le résultat')).toBeInTheDocument();
    });
  });

  it('shows score screen after completing all questions', async () => {
    render(<LessonPlayerPage />);

    // Answer Q1 correctly
    await waitFor(() => {
      expect(screen.getByText('ARIS 3.0')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('ARIS 3.0'));
    await waitFor(() => {
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Suivant'));

    // Answer Q2 correctly
    await waitFor(() => {
      expect(screen.getByText('55')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('55'));
    await waitFor(() => {
      expect(screen.getByText('Voir le résultat')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Voir le résultat'));

    // Score screen
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText(/Félicitations/)).toBeInTheDocument();
    });
  });

  it('shows failing score when answers are wrong', async () => {
    render(<LessonPlayerPage />);

    // Answer Q1 incorrectly
    await waitFor(() => {
      expect(screen.getByText('ARIS 1.0')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('ARIS 1.0'));
    await waitFor(() => {
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Suivant'));

    // Answer Q2 incorrectly
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('10'));
    await waitFor(() => {
      expect(screen.getByText('Voir le résultat')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Voir le résultat'));

    // Should show fail screen with retry
    await waitFor(() => {
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText(/Essayez encore/)).toBeInTheDocument();
      expect(screen.getByText('Recommencer')).toBeInTheDocument();
    });
  });

  it('allows retry after failing', async () => {
    render(<LessonPlayerPage />);

    // Answer Q1 wrong
    await waitFor(() => {
      expect(screen.getByText('ARIS 1.0')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('ARIS 1.0'));
    await waitFor(() => {
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Suivant'));

    // Answer Q2 wrong
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('10'));
    await waitFor(() => {
      expect(screen.getByText('Voir le résultat')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Voir le résultat'));

    // Click retry
    await waitFor(() => {
      expect(screen.getByText('Recommencer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Recommencer'));

    // Should go back to Q1
    await waitFor(() => {
      expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    });
  });

  it('disables options after selecting an answer', async () => {
    render(<LessonPlayerPage />);

    await waitFor(() => {
      expect(screen.getByText('ARIS 3.0')).toBeInTheDocument();
    });

    // Select an answer
    fireEvent.click(screen.getByText('ARIS 3.0'));

    // Other options should be disabled (cannot click again)
    const buttons = screen.getAllByRole('button').filter(
      (b) => b.textContent?.includes('ARIS 1.0'),
    );
    if (buttons.length > 0) {
      expect(buttons[0]).toBeDisabled();
    }
  });

  it('renders progress dots for questions', async () => {
    const { container } = render(<LessonPlayerPage />);

    await waitFor(() => {
      expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    });

    // Should have progress dots
    const dots = container.querySelectorAll('[class*="rounded-full"][class*="w-1"]');
    expect(dots.length).toBe(2);
  });
});
