export type TenantStatus = 'preview' | 'live';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface ApiTenant {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  accent: string | null;
  timezone: string;
  currency: string;
  locale: string;
  status: TenantStatus;
  phone: string | null;
  address: string | null;
  mapUrl: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
  social: Record<string, string> | null;
  bookingLeadMinutes: number;
  cancelWindowMinutes: number;
  slotStepMinutes: number;
  hoursSummary: string[];
  infoCards: InfoCard[];
}

export interface InfoCard {
  id: string;
  title: string;
  body: string;
  icon: string | null;
}

export interface ApiService {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  resourceKind: string | null;
  sort: number;
}

export interface ApiWork {
  id: string;
  imageUrl: string;
  caption: string | null;
  sort: number;
}

export interface ApiAvailabilityDay {
  date: string;
  isClosed: boolean;
  slots: string[];
}

export interface ApiAvailabilityResponse {
  timezone: string;
  serviceId: string;
  durationMinutes: number;
  days: ApiAvailabilityDay[];
}

export interface ApiCustomer {
  name: string;
  phone: string;
  car: string | null;
  comment: string | null;
}

export interface ApiBooking {
  id: string;
  tenantSlug: string;
  status: BookingStatus;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  car: string | null;
  comment: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  resourceName: string | null;
  canCancel: boolean;
  icsUrl: string;
}

export interface ApiCreateBookingResponse {
  booking: ApiBooking;
  accessToken: string;
  replayed: boolean;
}

export interface ApiStats {
  from: string;
  to: string;
  timezone: string;
  arrivals: number;
  completed: number;
  cancelled: number;
  receivedMinor: number;
  refundedMinor: number;
  upcomingMinor: number;
  currency: string;
}

export interface ApiNotificationJob {
  id: string;
  bookingId: string;
  kind: string;
  channel: string;
  scheduledFor: string;
  status: string;
  attempts: number;
}

export interface ApiAssistantReply {
  reply: string;
  intent: string;
  usedTools: string[];
  suggestions: string[];
}
