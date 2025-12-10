# Project Structure

```
dagron/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── package.json              # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Complete documentation
├── QUICKSTART.md             # Quick start guide
│
├── .vscode/                  # VS Code configurations
│   ├── extensions.json       # Recommended extensions
│   └── launch.json           # Debug configurations
│
├── src/                      # Source code (TypeScript)
│   ├── config/
│   │   └── index.ts          # Configuration management
│   │
│   ├── database/
│   │   └── index.ts          # Database connection pool
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts # Authentication & authorization
│   │
│   ├── routes/               # API routes
│   │   ├── auth.routes.ts    # Login/authentication
│   │   ├── payment.routes.ts # Payment verification
│   │   ├── spin.routes.ts    # Spin wheel
│   │   ├── payout.routes.ts  # Withdrawal requests
│   │   ├── user.routes.ts    # User profile
│   │   └── admin.routes.ts   # Admin operations
│   │
│   ├── services/             # Business logic
│   │   ├── tron.service.ts   # TRON blockchain integration
│   │   ├── payment.service.ts # Payment processing
│   │   ├── spin.service.ts   # Spin logic & probability
│   │   ├── payout.service.ts # Withdrawal processing
│   │   └── user.service.ts   # User management
│   │
│   ├── utils/
│   │   └── logger.ts         # Winston logger
│   │
│   └── server.ts             # Express server entry point
│
├── database/
│   └── schema.sql            # PostgreSQL database schema
│
├── public/                   # Frontend HTML files
│   ├── index.html            # Home page
│   ├── pay.html              # Payment page
│   ├── game.html             # Game page (placeholder)
│   ├── spin.html             # Spin wheel page
│   ├── withdraw.html         # Withdrawal page (to create)
│   └── invite.html           # Invite page (to create)
│
├── scripts/
│   └── check-config.js       # Configuration validation script
│
├── logs/                     # Application logs (auto-created)
│   ├── combined.log
│   └── error.log
│
├── exports/                  # CSV exports (auto-created)
│   └── .gitkeep
│
└── dist/                     # Compiled JavaScript (auto-created)
    └── ...
```

## File Descriptions

### Configuration Files
- `.env.example` - Template for environment variables
- `package.json` - Node.js project manifest and dependencies
- `tsconfig.json` - TypeScript compiler options

### Source Code (`src/`)
- `server.ts` - Main Express server with middleware setup
- `config/` - Centralized configuration management
- `database/` - PostgreSQL connection pool and query wrapper
- `middleware/` - Auth, rate limiting, and other middleware
- `routes/` - RESTful API endpoint definitions
- `services/` - Core business logic (payment, spin, payout, etc.)
- `utils/` - Shared utilities (logger, helpers)

### Database
- `schema.sql` - Complete database schema with tables, indexes, views, and triggers

### Frontend (`public/`)
- HTML5/CSS3/JavaScript files for Telegram Web App
- Responsive design for mobile devices
- Integrated with Telegram Web App SDK

### Scripts
- `check-config.js` - Pre-deployment configuration validator

## Key Features by File

### Backend Services

**tron.service.ts**
- Verify TRC20 transactions on TRON blockchain
- Send USDT payments
- Check balances and confirmations

**payment.service.ts**
- Submit payment verification
- Poll transaction status
- Track payment history

**spin.service.ts**
- Execute spin with CSPRNG randomness
- Calculate awards based on probability
- Handle large prize reviews

**payout.service.ts**
- Create withdrawal requests
- Calculate fees
- Batch approval and CSV export
- Mark payments as completed

**user.service.ts**
- User registration with invite codes
- Process invitations
- Manage user permissions

### API Routes

**auth.routes.ts**
- POST `/api/auth/login` - Telegram login

**payment.routes.ts**
- GET `/api/payment/info` - Get payment details
- POST `/api/payment/verify` - Submit transaction hash
- GET `/api/payment/status/:id` - Check payment status

**spin.routes.ts**
- POST `/api/spin` - Execute spin
- GET `/api/spin/history` - View spin history

**payout.routes.ts**
- POST `/api/payout/request` - Request withdrawal
- GET `/api/payout/history` - View withdrawal history

**admin.routes.ts**
- GET `/api/admin/payouts/pending` - List pending withdrawals
- POST `/api/admin/payouts/approve` - Approve withdrawal
- POST `/api/admin/payouts/batch-approve` - Batch approve
- POST `/api/admin/payouts/create-batch` - Create export batch
- POST `/api/admin/payouts/mark-paid` - Mark as paid
- POST `/api/admin/spins/approve` - Approve large prize
- POST `/api/admin/users/set-withdrawal-eligibility` - Set eligibility
- POST `/api/admin/users/ban` - Ban user

### Database Schema

**Core Tables:**
- `users` - User accounts and balances
- `payments` - Payment records
- `spins` - Spin results
- `payout_requests` - Withdrawal requests
- `payout_batches` - Withdrawal batches
- `invitations` - Referral tracking
- `balance_changes` - Balance audit trail
- `audit_logs` - System audit logs
- `risk_events` - Risk management events

## Technology Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 12+
- **Cache**: Redis (optional)
- **Blockchain**: TronWeb (TRC20)
- **Auth**: JWT
- **Logging**: Winston
- **Frontend**: HTML5 + CSS3 + Vanilla JS + Telegram Web App SDK

## Development Workflow

1. Install dependencies: `npm install`
2. Configure `.env` file
3. Initialize database: `psql dragon_game < database/schema.sql`
4. Run dev server: `npm run dev`
5. Build for production: `npm run build`
6. Start production: `npm start`

## Deployment Checklist

- [ ] Configure all required environment variables
- [ ] Change JWT_SECRET from default
- [ ] Set up PostgreSQL database
- [ ] Configure TRON mainnet settings
- [ ] Set platform wallet address
- [ ] Configure admin Telegram IDs
- [ ] Test payment flow end-to-end
- [ ] Test withdrawal approval flow
- [ ] Set up HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up log rotation
- [ ] Configure database backups
- [ ] Test Telegram Bot integration
