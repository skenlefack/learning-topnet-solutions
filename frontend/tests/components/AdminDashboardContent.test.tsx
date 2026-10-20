// ============================================================================
// Topnet Solutions Academy — Component Test: AdminDashboardContent
// Lightweight tests for tab navigation and initial render
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDashboardContent from '@/app/admin/AdminDashboardContent';

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { firstName: 'Admin', lastName: 'Continental', role: 'admin_continental' },
    token: 'test-token',
  }),
}));

// Mock APIs
vi.mock('@/lib/api', () => ({
  adminApi: {
    stats: vi.fn().mockResolvedValue({ data: { totalLearners: 1250, activeCourses: 12, certificationsIssued: 340, countriesConnected: 42 } }),
    users: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    createUser: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
    updateUser: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
    bulkImport: vi.fn().mockResolvedValue({ data: { imported: 0, failed: 0 } }),
    tenants: vi.fn().mockResolvedValue({ data: [] }),
    courseAnalytics: vi.fn().mockResolvedValue({ data: {} }),
  },
  courseApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({ data: { id: 'c1' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'c1' } }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
  liveApi: {
    sessions: vi.fn().mockResolvedValue({ data: [] }),
    createSession: vi.fn().mockResolvedValue({ data: { id: 's1' } }),
  },
  assessmentApi: {
    certifications: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock recharts to avoid canvas/SVG issues in jsdom
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Legend: () => null,
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock lazy components
vi.mock('@/app/admin/_components/lazy', () => ({
  CourseFormModal: () => null,
  PlanSessionModal: () => null,
  UserFormModal: () => null,
  BulkUserImportModal: () => null,
  CourseAnalytics: () => null,
}));

describe('AdminDashboardContent', () => {
  it('renders admin dashboard tabs', async () => {
    render(<AdminDashboardContent />);
    await waitFor(() => {
      expect(screen.getByText(/Tableau de bord|Dashboard/i)).toBeInTheDocument();
    });
  });

  it('renders stat cards after loading', async () => {
    render(<AdminDashboardContent />);
    await waitFor(() => {
      // Stats are rendered as formatted numbers
      const text = document.body.textContent || '';
      expect(text).toMatch(/1[\s,.]?250/);
    });
  });

  it('renders courses tab', async () => {
    render(<AdminDashboardContent />);
    await waitFor(() => {
      expect(screen.getAllByText(/Cours/i).length).toBeGreaterThan(0);
    });
  });

  it('renders users tab', async () => {
    render(<AdminDashboardContent />);
    await waitFor(() => {
      expect(screen.getAllByText(/Utilisateurs|Users/i).length).toBeGreaterThan(0);
    });
  });

  it('renders sessions tab', async () => {
    render(<AdminDashboardContent />);
    await waitFor(() => {
      expect(screen.getAllByText(/Sessions/i).length).toBeGreaterThan(0);
    });
  });

  it('renders all tab buttons', async () => {
    render(<AdminDashboardContent />);
    await waitFor(() => {
      expect(screen.getAllByText(/Quiz/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Parcours/i).length).toBeGreaterThan(0);
  });
});
