# Flower Fairies 🧚‍♀️

A production-ready e-commerce platform for magical floral deliveries, built with React, Node.js, Express, and PostgreSQL.

## Features

- **Multi-Role System**: Customer, Driver, and Admin dashboards
- **Real-time Updates**: Server-Sent Events (SSE) for live order tracking
- **Secure Authentication**: JWT-based auth with access/refresh tokens
- **Payment Integration**: Optional Stripe integration (gracefully disabled when not configured)
- **Caching Layer**: Redis with in-memory fallback
- **Responsive Design**: Modern UI with Tailwind CSS
- **Type Safety**: Full TypeScript implementation

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 12+
- Redis (optional, falls back to in-memory cache)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/rpfran523/FFIV.git
cd FFIV
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
psql -U your_user -d your_database -f server/db/schema.sql
psql -U your_user -d your_database -f server/db/seed.sql
```

5. Start development servers:
```bash
npm run dev
```

The client will be available at http://localhost:5173 and the API at http://localhost:8080.

## Azure Deployment

### Build for Production

```bash
npm run build
```

This creates a `dist` folder with the production-ready application.

### Azure App Service Setup

1. Create an Azure Web App for Containers
2. Configure environment variables in Application Settings:

```
NODE_ENV=production
PORT=8080
DATABASE_URL=your_postgresql_connection_string
JWT_ACCESS_SECRET=your_secure_secret
JWT_REFRESH_SECRET=your_secure_secret
# Optional
REDIS_URL=your_redis_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
```

3. Deploy using the provided GitHub Actions workflow:
   - Set up `AZURE_WEBAPP_NAME` and `AZURE_PUBLISH_PROFILE` secrets in GitHub
   - Push to `main` branch to trigger deployment

### Using the Dockerfile

```bash
docker build -f infra/azure-webapp.dockerfile -t flower-fairies .
docker run -p 8080:8080 --env-file .env flower-fairies
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Environment (development/production) |
| `PORT` | Yes | Server port (default: 8080) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Yes | Secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token expiry (default: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token expiry (default: 7d) |
| `REDIS_URL` | No | Redis connection string (optional) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (optional) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook secret (optional) |
| `CORS_ORIGIN` | No | CORS origin (default: http://localhost:5173) |

## Demo Accounts

The seed data includes these demo accounts (all use the same password):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@flowerfairies.com | FullMoon1!!! |
| Driver | driver1@flowerfairies.com | FullMoon1!!! |
| Driver | driver2@flowerfairies.com | FullMoon1!!! |
| Customer | customer1@flowerfairies.com | FullMoon1!!! |
| Customer | customer2@flowerfairies.com | FullMoon1!!! |

## API Routes

### Authentication
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/refresh` | Refresh tokens | No |
| POST | `/api/auth/logout` | Logout user | Yes |
| GET | `/api/auth/me` | Get current user | Yes |

### Products
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/products` | List products | No |
| GET | `/api/products/categories` | Get categories | No |
| GET | `/api/products/featured` | Get featured products | No |
| GET | `/api/products/:id` | Get product details | No |

### Orders
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/orders` | List user orders | Yes (Customer) |
| GET | `/api/orders/:id` | Get order details | Yes |
| POST | `/api/orders` | Create order | Yes (Customer) |
| PATCH | `/api/orders/:id/status` | Update order status | Yes (Admin/Driver) |
| POST | `/api/orders/:id/cancel` | Cancel order | Yes |

### Admin
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/admin/analytics` | Get analytics dashboard | Yes (Admin) |
| GET | `/api/admin/orders` | List all orders | Yes (Admin) |
| GET | `/api/admin/users` | List all users | Yes (Admin) |
| GET | `/api/admin/products/inventory` | Get inventory | Yes (Admin) |
| POST | `/api/admin/cache/clear` | Clear cache | Yes (Admin) |

### Driver
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/driver/profile` | Get driver profile | Yes (Driver) |
| PATCH | `/api/driver/availability` | Update availability | Yes (Driver) |
| POST | `/api/driver/location` | Update location | Yes (Driver) |
| GET | `/api/driver/orders/available` | Get available orders | Yes (Driver) |
| GET | `/api/driver/orders/active` | Get active deliveries | Yes (Driver) |
| POST | `/api/driver/orders/:id/accept` | Accept order | Yes (Driver) |
| POST | `/api/driver/orders/:id/complete` | Complete delivery | Yes (Driver) |
| GET | `/api/driver/earnings` | Get earnings | Yes (Driver) |

### Payments (Stripe)
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/stripe/payment-intents` | Create payment intent | Yes |
| POST | `/api/stripe/confirm-payment` | Confirm payment | Yes |
| GET | `/api/stripe/config` | Get Stripe config | No |
| POST | `/api/stripe/webhook` | Stripe webhook | No |

### Real-time Events (SSE)
| Route | Description | Auth |
|-------|-------------|------|
| `/api/events` | SSE endpoint for live updates | Optional |

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - User accounts with roles
- `products` - Product catalog
- `variants` - Product variations
- `prices` - Pricing and inventory
- `orders` - Customer orders
- `order_items` - Order line items
- `drivers` - Driver profiles
- `driver_locations` - Real-time driver locations
- `analytics` - Cached analytics data

## Architecture

```
FFIV/
├── client/          # React + Vite frontend
├── server/          # Express + TypeScript backend
├── infra/           # Infrastructure files
│   ├── azure-webapp.dockerfile
│   └── github-actions.yml
├── scripts/         # Build and test scripts
└── dist/            # Production build output
```

## Security

- Helmet.js for security headers
- Rate limiting on API endpoints
- Parameterized SQL queries
- JWT token rotation
- Input validation with Joi
- CORS configuration

## Monitoring

- Health check endpoint at `/health`
- Request logging
- Error tracking
- SSE connection monitoring

## Development

### Running Tests

```bash
npm run smoke
```

### Building for Production

```bash
npm run build
```

### Cleaning Build Artifacts

```bash
npm run clean
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`

### Redis Connection Issues
- The app will fall back to in-memory cache if Redis is unavailable
- Check Redis connection string format

### Build Issues
- Ensure Node.js 20+ is installed
- Run `npm run clean` and retry
- Check for TypeScript errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.