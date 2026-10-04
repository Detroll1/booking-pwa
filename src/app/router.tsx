import {Navigate, createBrowserRouter, createHashRouter} from 'react-router-dom';
import {defaultTenantSlug, tenantPath} from '@/lib/tenant/resolve';
import {TenantLayout} from '@/components/layout/TenantLayout';
import {TenantHomePage} from '@/routes/public/TenantHomePage';
import {TenantServicesPage} from '@/routes/public/TenantServicesPage';
import {BookingFlowPage} from '@/routes/public/BookingFlowPage';
import {MyBookingPage} from '@/routes/public/MyBookingPage';
import {AssistantPage} from '@/routes/public/AssistantPage';
import {InstallPage} from '@/routes/public/InstallPage';
import {OwnerLayout} from '@/routes/owner/OwnerLayout';
import {OwnerLoginPage} from '@/routes/owner/OwnerLoginPage';
import {OwnerSchedulePage} from '@/routes/owner/OwnerSchedulePage';
import {OwnerBookingsPage} from '@/routes/owner/OwnerBookingsPage';
import {OwnerServicesPage} from '@/routes/owner/OwnerServicesPage';
import {OwnerMediaPage} from '@/routes/owner/OwnerMediaPage';
import {OwnerStatsPage} from '@/routes/owner/OwnerStatsPage';
import {OwnerSettingsPage} from '@/routes/owner/OwnerSettingsPage';
import {NotFoundPage} from '@/routes/NotFoundPage';

// On a static host without rewrite rules (e.g. GitHub Pages) the app builds a
// hash router so every deep link resolves to the served index.html. The primary
// Cloudflare Pages target uses the normal history router.
export const router = (import.meta.env.VITE_HASH_ROUTER === 'true' ? createHashRouter : createBrowserRouter)([
  {path: '/', element: <Navigate to={tenantPath(defaultTenantSlug())} replace />},
  {
    path: '/s/:slug',
    element: <TenantLayout />,
    children: [
      {index: true, element: <TenantHomePage />},
      {path: 'services', element: <TenantServicesPage />},
      {path: 'ai', element: <AssistantPage />},
      {path: 'install', element: <InstallPage />},
      {path: 'book', element: <BookingFlowPage />},
      {path: 'booking', element: <MyBookingPage />},
      {path: 'booking/:token', element: <MyBookingPage />},
      {
        path: 'owner',
        element: <OwnerLayout />,
        children: [
          {index: true, element: <Navigate to="schedule" replace />},
          {path: 'login', element: <OwnerLoginPage />},
          {path: 'schedule', element: <OwnerSchedulePage />},
          {path: 'bookings', element: <OwnerBookingsPage />},
          {path: 'services', element: <OwnerServicesPage />},
          {path: 'media', element: <OwnerMediaPage />},
          {path: 'stats', element: <OwnerStatsPage />},
          {path: 'settings', element: <OwnerSettingsPage />},
        ],
      },
    ],
  },
  {path: '*', element: <NotFoundPage />},
]);

export const ownerRoutes = ['schedule', 'bookings', 'services', 'media', 'stats', 'settings'] as const;
