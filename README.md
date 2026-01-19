# Square 15 Property Management System

A comprehensive full-stack property management and business operations platform built with modern technologies.

## 🚀 Features

### Core Modules

- **👥 Customer Relationship Management (CRM)**
  - Lead tracking and scoring with AI
  - Sales pipeline management
  - Email campaigns and bulk communications
  - Customer analytics and insights

- **📊 Project Management**
  - Project tracking with milestones
  - Budget management and tracking
  - Gantt charts and timelines
  - Risk management and alerts
  - Comprehensive project reporting

- **👷 Human Resources**
  - Employee management
  - Performance tracking and reviews
  - Leave management
  - KPI tracking
  - Document management

- **💰 Financial Management**
  - Invoicing and quotations
  - Payment tracking
  - Expense management
  - Financial reporting (P&L, Balance Sheet, Cash Flow)
  - Budget tracking

- **🛠️ Operations**
  - Order management
  - Artisan/contractor management
  - Job card generation
  - Asset and liability tracking

- **📧 Communications**
  - Internal messaging system
  - Email integration (SMTP)
  - Real-time notifications
  - Support chat widget

### Advanced Features

- **🤖 AI-Powered**
  - Lead scoring and classification
  - Expense categorization
  - Artisan recommendations
  - Coaching recommendations for employees

- **📱 Responsive Design**
  - Mobile-friendly interface
  - Role-based dashboards
  - Customizable layouts

- **🔐 Security & Access Control**
  - JWT authentication
  - Role-based permissions
  - Custom role creation
  - Fine-grained access control

## 🛠️ Tech Stack

### Frontend
- **React** - UI library
- **TanStack Router** - Type-safe routing
- **Tailwind CSS** - Utility-first styling
- **HeadlessUI** - Accessible components
- **Lucide React** - Icon library
- **Recharts** - Data visualization

### Backend
- **Node.js** - Runtime environment
- **tRPC** - End-to-end typesafe APIs
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Primary database
- **Redis** - Caching and real-time features

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **MinIO** - Object storage (S3-compatible)
- **Nginx** - Reverse proxy
- **GitHub Actions** - CI/CD

### Additional Tools
- **Zustand** - State management
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **React Hot Toast** - Notifications

## 🚀 Getting Started

### Prerequisites


### Quick Start

### Node.js version

This project requires Node.js `>=20 <22` (see `package.json` `engines`). If you run it on Node 22+, the server may start and then immediately exit, and you will see `ERR_CONNECTION_REFUSED` when browsing `http://localhost:3000`.

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sqr15-prop-management-system
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   nano .env
   ```

3. **Start the application**
   ```bash
   ./scripts/run
   ```

   Or using Docker Compose directly:
   ```bash
   cd docker
   docker compose up
   ```

4. **Access the application**
   - **Main app**: http://localhost:8000
   - **MinIO console**: http://localhost:9001 (admin / ADMIN_PASSWORD)
   - **Database admin**: http://localhost:8000/codapt/db/ (admin / ADMIN_PASSWORD)

5. **Default login credentials**
   - **Admin**: admin@example.com / password
   - **Artisan**: artisan@example.com / password
   - **Customer**: customer@example.com / password

### Development Mode

The application runs in development mode by default with hot reloading enabled.

To enable demo data seeding (useful for testing):
```bash
echo "SEED_DEMO_DATA=true" >> .env
```

## 📦 Preview Deployments

This project includes an automated preview deployment system for testing pull requests and feature branches.

### How It Works

When you open a pull request or push to a feature branch:
1. GitHub Actions automatically builds and tests your changes
2. A Docker image is created and pushed to GitHub Container Registry
3. The PR is automatically commented with deployment instructions
4. You can deploy the preview to various platforms or your own server

### Quick Preview Deploy

```bash
# Pull the preview image
docker pull ghcr.io/your-org/your-repo:pr-123

# Deploy with docker compose
cd docker
PREVIEW_IMAGE=ghcr.io/your-org/your-repo:pr-123 docker compose -f compose.preview.yaml up -d
```

### Supported Platforms

- **Manual deployment** to any Docker-enabled server
- **DigitalOcean** App Platform
- **Railway** - Simple deployment with CLI
- **Render** - Free tier available
- **Fly.io** - Global edge deployment

📖 **Full documentation**: [PREVIEW_DEPLOYMENT.md](./PREVIEW_DEPLOYMENT.md)

## 📚 Documentation

- **[Preview Deployment Guide](./PREVIEW_DEPLOYMENT.md)** - Deploy preview environments
- **[Deployment Troubleshooting](./DEPLOYMENT_TROUBLESHOOTING.md)** - Common deployment issues
- **[Email Configuration](./EMAIL_CONFIGURATION_GUIDE.md)** - Set up SMTP email
- **[Gmail Setup](./GMAIL_APP_PASSWORD_SETUP.md)** - Configure Gmail for sending emails
- **[Access Control Guide](./ACCESS_CONTROL_GUIDE.md)** - Manage roles and permissions
- **[Testing Checklist](./TESTING_CHECKLIST.md)** - Testing guidelines

## 🏗️ Project Structure

```
├── src/
│   ├── routes/              # TanStack Router pages
│   │   ├── admin/          # Admin dashboard and modules
│   │   ├── artisan/        # Artisan/contractor interface
│   │   ├── customer/       # Customer portal
│   │   └── messages/       # Messaging system
│   ├── components/         # Reusable React components
│   ├── server/            # Backend code
│   │   ├── trpc/          # tRPC procedures and routers
│   │   ├── scripts/       # Setup and maintenance scripts
│   │   └── utils/         # Server utilities
│   ├── stores/            # Zustand state stores
│   └── utils/             # Client utilities
├── docker/                # Docker configuration
│   ├── Dockerfile        # Application container
│   ├── compose.yaml      # Development orchestration
│   └── compose.preview.yaml # Preview deployment
├── prisma/               # Database schema
└── public/               # Static assets
```

## 🔧 Configuration

### Environment Variables

All configuration is done through environment variables. See [`.env.example`](./.env.example) for a complete list.

**Critical variables:**
- `ADMIN_PASSWORD` - Admin password for services
- `JWT_SECRET` - Secret for JWT tokens
- `GEMINI_API_KEY` - Google Gemini API key for AI features
- `COMPANY_*` - Company information for documents
- `BRAND_*` - Brand colors for UI and PDFs
- `SMTP_*` - Email server configuration

### Generating Secure Secrets

```bash
# Generate random passwords
openssl rand -base64 32

# Add to .env file
echo "ADMIN_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

## 🧪 Testing

### Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Database Access

```bash
# Via Adminer web interface
open http://localhost:8000/codapt/db/

# Via psql
docker compose exec postgres psql -U postgres -d app
```

### Logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs app
docker compose logs postgres

# Follow logs in real-time
docker compose logs -f app
```

## 🐛 Troubleshooting

### Application won't start

1. Check if all services are running:
   ```bash
   docker compose ps
   ```

2. View application logs:
   ```bash
   docker compose logs app
   ```

3. Verify environment variables:
   ```bash
   docker compose config
   ```

4. See [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) for detailed solutions

### Common Issues

- **502 Bad Gateway**: App is still starting or crashed. Check logs.
- **Database connection failed**: Ensure PostgreSQL is running and credentials are correct.
- **MinIO connection failed**: Verify ADMIN_PASSWORD matches in .env and MinIO config.
- **Health check timeout**: Increase `start_period` in docker-compose.yaml.

## 🔄 Updates and Maintenance

### Update dependencies

```bash
pnpm update
```

### Database migrations

```bash
pnpm exec prisma db push
```

### Clean restart

```bash
docker compose down -v
docker compose up --build
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Open a pull request
4. Preview deployment will be automatically created
5. Test the preview before merging

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

Built with:
- [TanStack Router](https://tanstack.com/router)
- [tRPC](https://trpc.io/)
- [Prisma](https://www.prisma.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Docker](https://www.docker.com/)

## 📞 Support

For issues and questions:
1. Check the documentation files
2. Review GitHub Issues
3. Contact the development team

---

**Made with ❤️ for Square 15 Facility Solutions**
