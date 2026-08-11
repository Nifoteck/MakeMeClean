# MakeMeClean

A professional booking platform for cleaning services across Wales, UK.

## Overview

MakeMeClean is a modern, full-featured booking system designed for domestic and commercial cleaning services. Customers can book online, manage recurring plans, track loyalty rewards, and receive automated reminders. Admins get a complete dashboard for managing bookings, staff, payments, and customer interactions.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Routing:** Wouter (lightweight client-side routing)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Email:** Brevo API (transactional emails via Edge Functions)
- **AI:** Groq API (customer chat widget)
- **Package Manager:** pnpm

## Key Features

### For Customers
- **Online Booking** — 3-step wizard with service selection, date/time, and confirmation
- **Recurring Plans** — Subscribe to weekly, fortnightly, or monthly cleanings with discounts (5–15%)
- **Loyalty Rewards** — Earn points, unlock tiers (Bronze → Silver → Gold → Platinum), redeem rewards
- **Booking Management** — View, reschedule, or cancel bookings with 3-hour policy
- **Photo Uploads** — Share photos of completed work
- **Refund Requests** — Request refunds with reason; admins review and process
- **AI Chat Widget** — 24/7 customer support via conversational AI
- **Payment Tracking** — Invoices and payment history
- **Reviews** — Leave feedback after completed bookings

### For Admins
- **Dashboard** — Overview of all bookings with status and assignment
- **Staff Management** — Manage team members, availability, and assignments
- **Payroll** — Track staff payments with automated payslip generation
- **Refunds** — Review and approve/reject refund requests
- **Photo Gallery** — Browse and download customer photos
- **Loyalty Management** — Award bonus points, create/manage rewards, view leaderboard
- **Recruitment** — Job postings, application pipeline, applicant management
- **Settings** — Centralized configuration (contact info, email addresses, reminder schedules)
- **Newsletter** — Compose and send campaigns to subscribers
- **Service Management** — Configure services, pricing, and images

### For Staff
- **Shift Management** — View assigned bookings and confirm/decline shifts
- **Availability** — Set weekly availability
- **Payslips** — Download monthly payslips

## Getting Started

### Prerequisites
- Node.js (v16+)
- pnpm
- Supabase account

### Installation

```bash
git clone https://github.com/yourusername/makemeclean.git
cd makemeclean
pnpm install
```

### Environment Setup

Create a `.env.local` file (frontend / Vite):

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Set server-side secrets for Supabase Edge Functions (NOT Vercel env vars):

```bash
supabase secrets set GROQ_API_KEY=your_groq_api_key
supabase secrets set BREVO_API_KEY=your_brevo_api_key
```

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:5000`

### Production

```bash
pnpm build
pnpm preview
```

## Deployment

### Database & Auth
1. Create a Supabase project
2. Run SQL schema from `supabase-schema.sql` in the SQL editor
3. Configure authentication providers (Email, Google, etc.)

### Edge Functions
Deploy the following Edge Functions:

```bash
supabase functions deploy send-otp
supabase functions deploy verify-otp
supabase functions deploy reset-password
supabase functions deploy notifications
supabase functions deploy send-recruitment-email
supabase functions deploy assign-staff
supabase functions deploy send-booking-reminders
supabase functions deploy ai-chat
supabase functions deploy send-newsletter
```

### Hosting
Deploy to Vercel, Netlify, or any static host:

```bash
pnpm build
# Deploy the `dist/` folder
```

## Configuration

All business settings (contact info, email addresses, reminder schedules) are managed via the admin panel at `/admin/settings` and stored in the database. No environment variables needed for configuration.

## Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/book` | Booking wizard |
| `/bookings` | Customer booking history |
| `/loyalty` | Loyalty rewards & points |
| `/dashboard` | Customer dashboard |
| `/admin` | Admin booking management |
| `/admin/loyalty` | Loyalty management |
| `/admin/staff` | Staff management |
| `/admin/payroll` | Payroll & payslips |

## Security

- Row-level security (RLS) on all database tables
- Supabase auth for user authentication
- Staff & admin roles verified via database checks
- PCI-DSS compliance via Stripe integration for payments
- GDPR-compliant with privacy policy and data handling procedures

## Support

For issues, feature requests, or questions:
- **Email:** contact@makemeclean.co.uk
- **Website:** https://makemeclean.co.uk

## License

Proprietary — All rights reserved.
