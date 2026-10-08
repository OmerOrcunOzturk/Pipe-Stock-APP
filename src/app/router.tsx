import { createBrowserRouter } from 'react-router'
import AppLayout from '@/components/layout/AppLayout'
import RequireAuth from '@/features/auth/components/RequireAuth'
import LoginPage from '@/features/auth/pages/LoginPage'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import DefinitionsPage from '@/features/definitions/pages/DefinitionsPage'
import DistributionsPage from '@/features/distributions/pages/DistributionsPage'
import NewDistributionPage from '@/features/distributions/pages/NewDistributionPage'
import NewReceiptPage from '@/features/receipts/pages/NewReceiptPage'
import ReceiptsPage from '@/features/receipts/pages/ReceiptsPage'
import ReportsPage from '@/features/reports/pages/ReportsPage'
import AdjustmentsPage from '@/features/stock/pages/AdjustmentsPage'
import NewAdjustmentPage from '@/features/stock/pages/NewAdjustmentPage'
import ProductMovementsPage from '@/features/stock/pages/ProductMovementsPage'
import StockPage from '@/features/stock/pages/StockPage'
import ErrorPage from './ErrorPage'
import NotFoundPage from './NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/oturum-ac',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'stok', element: <StockPage /> },
      { path: 'stok/duzeltme', element: <AdjustmentsPage /> },
      { path: 'stok/duzeltme/yeni', element: <NewAdjustmentPage /> },
      { path: 'stok/:productId', element: <ProductMovementsPage /> },
      { path: 'giris', element: <ReceiptsPage /> },
      { path: 'giris/yeni', element: <NewReceiptPage /> },
      { path: 'dagitim', element: <DistributionsPage /> },
      { path: 'dagitim/yeni', element: <NewDistributionPage /> },
      { path: 'tanimlar', element: <DefinitionsPage /> },
      { path: 'raporlar', element: <ReportsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
